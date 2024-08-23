package aeonics.oidc.op;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.Signature;
import java.util.Base64;
import java.util.Objects;
import java.util.StringJoiner;

import aeonics.data.Data;
import aeonics.entity.Entity;
import aeonics.entity.Message;
import aeonics.entity.Registry;
import aeonics.entity.security.Group;
import aeonics.entity.security.Provider;
import aeonics.entity.security.Role;
import aeonics.entity.security.Token;
import aeonics.entity.security.User;
import aeonics.http.Endpoint;
import aeonics.http.HttpException;
import aeonics.manager.Manager;
import aeonics.manager.Security;
import aeonics.oidc.Common;
import aeonics.oidc.TOTP;
import aeonics.oidc.rp.RelyingParty;
import aeonics.template.Parameter;
import aeonics.template.Template;
import aeonics.util.Json;
import aeonics.util.StringUtils;
import aeonics.util.Tuples.Tuple;

@SuppressWarnings("unused")
public class Endpoints 
{
	private Endpoints() { /* no instances */ }
	
	/**
	 * Validates the input scope based on the existing roles available for that registered client
	 * @param client the registered client
	 * @param scope the requested scope
	 * @return the normalized scope with unavailable roles are removed
	 */
	private static String validateScope(RelyingParty.Type client, String scope, User.Type user)
	{
		Objects.requireNonNull(client);
		Objects.requireNonNull(user);
		if( scope == null ) scope = "";
		
		StringJoiner sj = new StringJoiner(" ").add("topic").add("http");
		String[] scopes = StringUtils.split(scope, " ");
		for( String s : scopes )
		{
			Role.Type r = Registry.of(Role.class).get(s);
			if( r != null && client.hasScope(r.id()) && user.hasRole(r) ) sj.add(s);
		}
		
		return sj.toString();
	}
	
	/**
	 * Generates a JWT ID token
	 * @param client the client
	 * @param user the user
	 * @param nonce the nonce
	 * @param scope the scope
	 * @param token the token
	 * @return the jwt
	 */
	private static String generateIdToken(RelyingParty.Type client, User.Type user, String nonce, String token, String code) throws Exception
	{
		Signature signature = Signature.getInstance("SHA256withRSA");
		signature.initSign(Common.OP_PRIVATE_KEY);
		
		Data id_token = Data.map()
			.put("iss", Common.OP_ISSUER_URL)
			.put("sub", user.id())
			.put("aud", client.clientId())
			.put("exp", System.currentTimeMillis()/1000 + Common.OP_ID_TOKEN_TTL)
			.put("iat", System.currentTimeMillis()/1000)
			.put("acr", "0")
			.put("name", user.name());
		
		if( token != null && !token.isBlank() )
		{
			signature.update(token.substring(0, 16).getBytes());
			id_token.put("at_hash", Base64.getUrlEncoder().withoutPadding().encodeToString(signature.sign()));
		}
		
		if( code != null && !code.isBlank() )
		{
			signature.update(code.substring(0, 16).getBytes());
			id_token.put("c_hash", Base64.getUrlEncoder().withoutPadding().encodeToString(signature.sign()));
		}
		
		if( nonce != null && !nonce.isBlank() )
			id_token.put("nonce", nonce);
		
		String jwt = 
			  Base64.getUrlEncoder().withoutPadding().encodeToString(Data.map().put("alg", "RS256").put("kid", "default").put("typ", "JWT").toString().getBytes())
			+ "."
			+ Base64.getUrlEncoder().withoutPadding().encodeToString(id_token.toString().getBytes());
		
		signature.update(jwt.getBytes());
		
		jwt += "." + Base64.getUrlEncoder().withoutPadding().encodeToString(signature.sign());
		return jwt;
	}
	
	/**
	 * Builds a redirect http error
	 * @param location the target location
	 * @return the redirect data
	 */
	private static Data redirectError(RelyingParty.Type client, String error, String description, String state, boolean sensitive)
	{
		String uri = client.redirectUri();
		
		if( sensitive )
		{
			if( uri.indexOf('#') < 0 ) uri += "#";
			else if( !uri.endsWith("#") && !uri.endsWith("&") ) uri += "&";
		}
		else if( uri.indexOf('?') > 0 )
		{
			if( !uri.endsWith("?") && !uri.endsWith("&") ) uri += "&";
		}
		else if( uri.indexOf('#') > 0 )
		{
			if( !uri.endsWith("#") && !uri.endsWith("&") ) uri += "&";
		}
		else uri += "?";

		uri += "error=" + (error == null ? "server_error" : error) + "&error_description=" + java.net.URLEncoder.encode(description == null ? "" : description, StandardCharsets.ISO_8859_1);
		if( state != null && !state.isBlank() ) uri += "&state=" + java.net.URLEncoder.encode(state, StandardCharsets.ISO_8859_1);
		
		return Data.map()
			.put("isHttpResponse", true)
			.put("code", 302)
			.put("headers", Data.map().put("Location", uri));
	}
	
	/**
	 * Builds a redirect http response
	 * @param location the target location
	 * @return the redirect data
	 */
	private static Data redirectResponse(String location)
	{
		return Data.map()
			.put("isHttpResponse", true)
			.put("code", 302)
			.put("headers", Data.map().put("Location", location));
	}
	
	// =============================
	//
	// .well-known Endpoint
	// 
	// =============================
	
	private static final Endpoint.Rest.Type wellknown = new Endpoint.Rest() { }
		.template()
		.summary("Provides OpenID Connect Provider metadata.")
		.description("Provides OpenID Connect Provider metadata.")
		.build()
		.<Endpoint.Rest.Type>cast()
		.process((params, user, request) ->
		{
			if( !request.metadata().asBool("tls") )
				throw new HttpException(400, Data.map().put("error", "invalid_request").put("error_description", "This endpoint must be called using a secure TLS connection."));
			
			return Data.map()
				// URL using the https scheme with no query or fragment components that the OP asserts as its Issuer Identifier.
				.put("issuer", Common.OP_ISSUER_URL)
				// URL of the OP's OAuth 2.0 Authorization Endpoint
				.put("authorization_endpoint", Common.OP_ISSUER_URL + "/oauth/authorize")
				// URL of the OP's OAuth 2.0 Token Endpoint
				.put("token_endpoint", Common.OP_ISSUER_URL + "/oauth/token") 
				// URL of the OP's UserInfo Endpoint
				.put("userinfo_endpoint", Common.OP_ISSUER_URL + "/oauth/userinfo") 
				// not official but wildly supported: URL of the OP's Token Revocation Endpoint
				.put("revocation_endpoint", Common.OP_ISSUER_URL + "/oauth/revoke")
				// URL of the OP's JWK Set document, which MUST use the https scheme
				.put("jwks_uri", Common.OP_ISSUER_URL + "/oauth/jwks")
				// JSON array containing a list of the OAuth 2.0 scope values that this server supports
				.put("scopes_supported", Data.list().add("openid")) 
				// JSON array containing a list of the OAuth 2.0 response_type values that this OP supports
				.put("response_types_supported", Data.list().add("code").add("token").add("id_token").add("id_token token").add("code id_token").add("code token").add("code id_token token"))
				// JSON array containing a list of the OAuth 2.0 response_mode values that this OP supports
				.put("response_modes_supported", Data.list().add("query").add("fragment"))
				// JSON array containing a list of the OAuth 2.0 Grant Type values that this OP supports
				.put("grant_types_supported", Data.list().add("authorization_code").add("implicit").add("refresh_token").add("password").add("client_credentials"))
				// JSON array containing a list of the Authentication Context Class References that this OP supports
				.put("acr_values_supported", Data.list().add("0"))
				// JSON array containing a list of the Subject Identifier types that this OP supports
				.put("subject_types_supported", Data.list().add("public"))
				// JSON array containing a list of the JWS signing algorithms (alg values) supported by the OP for the ID Token to encode the Claims in a JWT
				.put("id_token_signing_alg_values_supported", Data.list().add("RS256"))
				// 	JSON array containing a list of Client Authentication methods supported by this Token Endpoint
				.put("token_endpoint_auth_methods_supported", Data.list().add("client_secret_post"))
				// JSON array containing a list of the Claim Names of the Claims that the OpenID Provider MAY be able to supply values for
				.put("claims_supported", Data.list().add("name"))
				;
		})
		.url("/.well-known/openid-configuration")
		.method("GET")
		;
	
	private static final Endpoint.Rest.Type jwks = new Endpoint.Rest() { }
		.template()
		.summary("Provides the Json Web Key Set (JWK Set) used by this OP.")
		.description("Provides the Json Web Key Set (JWK Set) used by this OP.")
		.build()
		.<Endpoint.Rest.Type>cast()
		.process((params, user, request) ->
		{
			if( !request.metadata().asBool("tls") )
				throw new HttpException(400, Data.map().put("error", "invalid_request").put("error_description", "This endpoint must be called using a secure TLS connection."));
			
			return Data.map().put("keys", Data.list().add(Data.map()
				.put("kty", "RSA")
				.put("use", "sig")
				.put("alg", "RS256")
				.put("kid", "default")
				.put("n", Base64.getEncoder().withoutPadding().encodeToString(Common.OP_PUBLIC_KEY.getModulus().toByteArray()))
				.put("e", Base64.getEncoder().withoutPadding().encodeToString(Common.OP_PUBLIC_KEY.getPublicExponent().toByteArray()))
				));
		})
		.url("/oauth/jwks")
		.method("GET")
		;
	
	// =============================
	//
	// UI Login and Consent Endpoints
	// 
	// =============================
	
	private static class login_ extends Endpoint.Rest.Type
	{
		public Data process(Data params, User.Type user, Message request)
		{
			if( !request.metadata().asBool("tls") )
				throw new HttpException(400, Data.map().put("error", "invalid_request").put("error_description", "This endpoint must be called using a secure TLS connection."));
			
			String code = params.asString("code");
			if( code.isBlank() )
				throw new HttpException(400, Data.map().put("error", "invalid_request").put("error_description", "Missing code"));
			
			Data data = Common.Code.get(code);
			if( data == null )
				throw new HttpException(400, Data.map().put("error", "invalid_request").put("error_description", "Invalid code"));
			
			RelyingParty.Type c = Registry.of(RelyingParty.class).get(data.asString("client"));
			if( c == null )
			{
				Common.Code.remove(code);
				throw new HttpException(400, Data.map().put("error", "invalid_client").put("error_description", "Invalid client"));
			}
			
			if( !params.isMap("credentials") )
				params.put("credentials", Json.decode(params.asString("credentials")));
			if( !params.isMap("credentials") )
			{
				Common.Code.remove(code);
				throw new HttpException(400, Data.map().put("error", "invalid_request").put("error_description", "Invalid credentials"));
			}
			
			user = User.ANONYMOUS;
			
			if( !params.get("credentials").isEmpty("signin_token") )
			{
				Token t = Manager.of(Security.class).authenticate(params.get("credentials").asString("signin_token"), false);
				if( t == null || t.user() == User.ANONYMOUS || !t.inScope("signin") )
				{
					Common.Code.remove(code);
					return redirectError(c, "access_denied", "Invalid signin token", data.asString("state"), data.asString("flow").equals("implicit"));
				}
				data.put("signin_token", t.value());
				user = t.user();
			}
			else
			{
				for( Provider.Type p : Registry.of(Provider.class) )
				{
					user = p.authenticate(params.get("credentials"));
					if( user != null && user != User.ANONYMOUS )
						break;
				}
			}
			
			if( user == null || user == User.ANONYMOUS )
			{
				Common.Code.remove(code);
				return redirectError(c, "access_denied", "Invalid credentials", data.asString("state"), data.asString("flow").equals("implicit"));
			}
			
			// check if user is allowed by the client groups
			boolean member = false;
			for( Tuple<Entity, Data> group : c.relations("groups") )
			{
				if( user.isMemberOf((Group.Type) group.a) )
				{
					member = true;
					break;
				}
			}
				
			if( !member )
			{
				Common.Code.remove(code);
				return redirectError(c, "access_denied", "Missing group membership", data.asString("state"), data.asString("flow").equals("implicit"));
			}
			
			if( user.hasRole(Role.SUPERADMIN) || TOTP.enrolled(user) )
			{
				data.put("otp_user", user.id());
				Common.Code.put(code, data);
				
				return redirectResponse(Common.OP_ISSUER_URL + "/oauth/ui/mfa?code=" + code);
			}
			else
			{
				data.put("user", user.id());
				if( !data.containsKey("signin_token") )
					data.put("signin_token", Manager.of(Security.class).generateToken(user, Common.OP_ACCESS_TOKEN_TTL * 1000L, false, "signin").value());
				Common.Code.put(code, data);
				
				return redirectResponse(Common.OP_ISSUER_URL + "/oauth/ui/consent?code=" + code);
			}
		}
	}
	
	private static final Endpoint.Rest.Type login = new Endpoint.Rest() { }
		.target(login_.class)
		.creator(login_::new)
		.template()
		.summary("Handles OAuth login.")
		.description("Manages the OAuth login flow. Returns a redirection (code 302) to proceed with OAuth login.")
		.add(new Parameter("code")
			.summary("The authorization code")
			.description("The authorization code that was obtained from the authorize flow.")
			.optional(false)
			.min(1)
			.format(Parameter.Format.TEXT))
		.add(new Parameter("credentials")
			.summary("The login credentials")
			.description("The login credentials must be a JSON array.")
			.optional(false)
			.rule(Parameter.Rule.JSON_MAP)
			.format(Parameter.Format.JSON))
		.build()
		.<Endpoint.Rest.Type>cast()
		.url("/oauth/login")
		.method("POST")
		;
		
	private static class otp_ extends Endpoint.Rest.Type
	{
		public Data process(Data params, User.Type user, Message request)
		{
			if( !request.metadata().asBool("tls") )
				throw new HttpException(400, Data.map().put("error", "invalid_request").put("error_description", "This endpoint must be called using a secure TLS connection."));
			
			String code = params.asString("code");
			if( code.isBlank() )
				throw new HttpException(400, Data.map().put("error", "invalid_request").put("error_description", "Missing code"));
			
			Data data = Common.Code.get(code);
			if( data == null )
				throw new HttpException(400, Data.map().put("error", "invalid_request").put("error_description", "Invalid code"));
			
			RelyingParty.Type c = Registry.of(RelyingParty.class).get(data.asString("client"));
			if( c == null )
			{
				Common.Code.remove(code);
				throw new HttpException(400, Data.map().put("error", "invalid_client").put("error_description", "Invalid client"));
			}
			
			user = Registry.of(User.class).get(data.asString("otp_user"));
			if( user == null )
			{
				Common.Code.remove(code);
				return redirectError(c, "access_denied", "Tampered", data.asString("state"), data.asString("flow").equals("implicit"));
			}
			
			if( !TOTP.check(user, params.asString("otp")) )
			{
				Common.Code.remove(code);
				return redirectError(c, "access_denied", "Unauthorized", data.asString("state"), data.asString("flow").equals("implicit"));
			}
			else
			{
				// otp success -> redirect to consent
				data.put("user", user.id());
				if( !data.containsKey("signin_token") )
					data.put("signin_token", Manager.of(Security.class).generateToken(user, Common.OP_ACCESS_TOKEN_TTL * 1000L, false, "signin").value());
				Common.Code.put(code, data);
				
				return redirectResponse(Common.OP_ISSUER_URL + "/oauth/ui/consent?code=" + code);
			}
		}
	}
		
	private static final Endpoint.Rest.Type otp = new Endpoint.Rest() { }
		.target(otp_.class)
		.creator(otp_::new)
		.template()
		.summary("Handles OTP verification.")
		.description("Manages the MFA OTP verification and redirects to the consent page if succeeded.")
		.add(new Parameter("code")
			.summary("The authorization code")
			.description("The authorization code that was obtained from the authorize flow.")
			.optional(false)
			.min(1)
			.format(Parameter.Format.TEXT))
		.add(new Parameter("otp")
			.summary("The otp")
			.description("The one time password for the user that initiated the login.")
			.optional(false)
			.format(Parameter.Format.TEXT))
		.build()
		.<Endpoint.Rest.Type>cast()
		.url("/oauth/otp")
		.method("POST")
		;

	private static class consent_ extends Endpoint.Rest.Type
	{
		public Data process(Data params, User.Type user, Message request) throws Exception
		{
			if( !request.metadata().asBool("tls") )
				throw new HttpException(400, Data.map().put("error", "invalid_request").put("error_description", "This endpoint must be called using a secure TLS connection."));
			
			String code = params.asString("code");
			if (code.isBlank())
				throw new HttpException(400, Data.map().put("error", "invalid_request").put("error_description", "Missing code"));
			
			Data data = Common.Code.get(code);
			if (data == null)
				throw new HttpException(400, Data.map().put("error", "invalid_request").put("error_description", "Invalid code"));
			
			RelyingParty.Type c = Registry.of(RelyingParty.class).get(data.asString("client"));
			if( c == null )
			{
				Common.Code.remove(code);
				throw new HttpException(400, Data.map().put("error", "invalid_client").put("error_description", "Invalid client"));
			}
			
			if( !params.asBool("granted") ) // rejected consent
			{
				Common.Code.remove(code);
				return redirectError(c, "access_denied", "No consent", data.asString("state"), data.asString("flow").equals("implicit"));
			}
			
			user = Registry.of(User.class).get(data.asString("user"));
			if( user == null )
			{
				Common.Code.remove(code);
				return redirectError(c, "access_denied", "Tampered", data.asString("state"), data.asString("flow").equals("implicit"));
			}
			
			if( user == User.ANONYMOUS )
			{
				Common.Code.remove(code);
				return redirectError(c, "access_denied", "Unauthorized", data.asString("state"), data.asString("flow").equals("implicit"));
			}
			
			// =============== 
			// USER CONSENT IS OK
			
			String uri = c.redirectUri();
			
			if( data.asString("flow").equals("implicit") )
			{
				if( uri.indexOf('#') < 0 ) uri += "#";
				else if( !uri.endsWith("#") && !uri.endsWith("&") ) uri += "&";
			}
			else if( uri.indexOf('?') > 0 )
			{
				if( !uri.endsWith("?") && !uri.endsWith("&") ) uri += "&";
			}
			else if( uri.indexOf('#') > 0 )
			{
				if( !uri.endsWith("#") && !uri.endsWith("&") ) uri += "&";
			}
			else uri += "?";
			
			if( !data.isEmpty("state") )
				uri += "state=" + java.net.URLEncoder.encode(data.asString("state"), StandardCharsets.ISO_8859_1) + "&";
			
			/*
			 +-----------------------+-------------------------+
			 | "response_type" value | Flow                    |
             +-----------------------+-------------------------+
             | code                  | Authorization Code Flow |
             | token                 | Implicit Flow           |
             | id_token              | Implicit Flow           |
             | id_token token        | Implicit Flow           |
             | code id_token         | Hybrid Flow             |
             | code token            | Hybrid Flow             |
             | code id_token token   | Hybrid Flow             |
             +-----------------------+-------------------------+
			 */
			
			if( data.asString("response_type").contains("code") )
			{
				uri += (uri.endsWith("&") ? "" : "&" )
					+ "code=" + code;
			}
			
			String scope = validateScope(c, data.asString("scope"), user);
			String token = null;
			
			if( data.asString("response_type").equals("token") || data.asString("response_type").endsWith(" token") )
			{
				long expire_in = Common.OP_ACCESS_TOKEN_TTL;
				token = Manager.of(Security.class).generateToken(user, expire_in * 1000L, false, StringUtils.split(scope, " ")).value();
				uri += (uri.endsWith("&") ? "" : "&" )
					+ "access_token=" + token
					+ "&token_type=bearer"
					+ "&expires_in=" + expire_in;
			}
			
			if( data.asString("response_type").contains("id_token") )
			{
				uri += (uri.endsWith("&") ? "" : "&" )
					+ "id_token=" + generateIdToken(c, user, data.asString("nonce"), token, data.asString("response_type").contains("code") ? code : null);
			}
			
			return redirectResponse(uri);
		}
	}
	
	private static final Endpoint.Rest.Type consent = new Endpoint.Rest() { }
		.target(consent_.class)
		.creator(consent_::new)
		.template()
		.summary("Handles OAuth consent.")
		.description("Manages the consent step in OAuth flow. Internally uses the parameters: 'code' (mandatory) and 'state' (mandatory). Redirects users based on their consent. Returns a redirection (code 302) to proceed with OAuth consent.")
		.add(new Parameter("code")
			.summary("The authorization code")
			.description("The authorization code that was obtained from the authorize flow.")
			.optional(false)
			.min(1)
			.format(Parameter.Format.TEXT))
		.add(new Parameter("granted")
			.summary("The user consent")
			.description("The user consent to proceed.")
			.optional(false)
			.rule(Parameter.Rule.BOOLEAN)
			.format(Parameter.Format.BOOLEAN))
		.build()
		.<Endpoint.Rest.Type>cast()
		.url("/oauth/consent")
		.method("POST")
		;
	
	// =============================
	//
	// UserInfo & CodeInfo Endpoints & Session endpoint
	// 
	// =============================
		
	private static class codeinfo_ extends Endpoint.Rest.Type
	{
		public Data process(Data params, User.Type user, Message request)
		{
			if( !request.metadata().asBool("tls") )
				throw new HttpException(400, Data.map().put("error", "invalid_request").put("error_description", "This endpoint must be called using a secure TLS connection."));
			
			String code = params.asString("code");
			if( code.isBlank() )
				throw new HttpException(413, Data.map().put("error", "invalid_request").put("error_description", "Invalid code"));
			
			Data data = Common.Code.get(code);
			if( data == null ) throw new HttpException(413, Data.map().put("error", "invalid_request").put("error_description", "Invalid code"));
			
			RelyingParty.Type c = Registry.of(RelyingParty.class).get(data.asString("client"));
			if( c == null )
			{
				Common.Code.remove(code);
				throw new HttpException(400, Data.map().put("error", "invalid_client").put("error_description", "Invalid client"));
			}
			
			user = Registry.of(User.class).get(data.asString("user"));
			if( user == null )
			{
				Common.Code.remove(code);
				throw new HttpException(403, Data.map().put("error", "access_denied").put("error_description", "Tampered"));
			}
			
			Data info = Data.map()
				.put("name", c.name())
				.put("scope", data.get("scope"))
				.put("epoch", data.get("_time"))
				.put("ttl", Common.OP_AUTH_CODE_TTL*1000);
			
			if( params.asBool("verbose") )
			{
				if( data.containsKey("signin_token") )
					info.put("signin_token", data.get("signin_token"));
				if( data.containsKey("user") )
					info.put("user_id", user.id()).put("user_name", user.name());
			}
			
			return info;
		}
	}
		
	private static final Endpoint.Rest.Type codeinfo = new Endpoint.Rest() { }
		.target(codeinfo_.class)
		.creator(codeinfo_::new)
		.template()
		.summary("Provides OAuth client information.")
		.description("Returns information about the OAuth client and the scope for a given 'code' parameter. Returns a JSON object containing client name and scope (code 200).")
		.add(new Parameter("code")
			.summary("The authorization code")
			.description("The authorization code that was obtained from the authorize flow.")
			.optional(false)
			.min(1)
			.format(Parameter.Format.TEXT))
		.add(new Parameter("verbose")
			.summary("Request more output")
			.description("When set to true, this method will return additional information about the user if available.")
			.optional(true)
			.rule(Parameter.Rule.BOOLEAN)
			.format(Parameter.Format.BOOLEAN))
		.build()
		.<Endpoint.Rest.Type>cast()
		.url("/oauth/codeinfo")
		.method("GET")
		;
	
	private static class userinfo_ extends Endpoint.Rest.Type
	{
		public Data process(Data params, User.Type user, Message request)
		{
			if( !request.metadata().asBool("tls") )
				throw new HttpException(400, Data.map().put("error", "invalid_request").put("error_description", "This endpoint must be called using a secure TLS connection."));
			
			if( user == User.ANONYMOUS )
				throw new HttpException(401);
			
			return Data.map()
				.put("sub", user.id())
				.put("name", user.name())
				;
		}
	}
	
	private static Template<? extends Endpoint.Type> userinfo_ = new Endpoint.Rest() { }
		.target(userinfo_.class)
		.creator(userinfo_::new)
		.template()
		.summary("Returns Claims about the authenticated End-User.")
		.description("The UserInfo Endpoint is an OAuth 2.0 Protected Resource that returns Claims about the authenticated End-User. To obtain the requested Claims about the End-User, the Client makes a request to the UserInfo Endpoint using an Access Token obtained through OpenID Connect Authentication. These Claims are normally represented by a JSON object that contains a collection of name and value pairs for the Claims.")
		;
			
	private static final Endpoint.Rest.Type userinfo_get = userinfo_
		.build()
		.<Endpoint.Rest.Type>cast()
		.url("/oauth/userinfo")
		.method("GET")
		;
	
	private static final Endpoint.Rest.Type userinfo_post = userinfo_
		.build()
		.<Endpoint.Rest.Type>cast()
		.url("/oauth/userinfo")
		.method("GET")
		;
	
	private static class session_ extends Endpoint.Rest.Type
	{
		public Data process(Data params, User.Type user, Message request)
		{
			if( !request.metadata().asBool("tls") )
				throw new HttpException(400, Data.map().put("error", "invalid_request").put("error_description", "This endpoint must be called using a secure TLS connection."));
			
			Token t = Manager.of(Security.class).authenticate(params.asString("signin_token"), false);
			if( t == null || t.user() == User.ANONYMOUS || !t.inScope("signin") )
				throw new HttpException(400, Data.map().put("error", "invalid_request").put("error_description", "Invalid sign in token."));
			
			return Data.map()
				.put("id", t.user().id())
				.put("name", t.user().name())
				.put("expire", t.notAfter())
				;
		}
	}
		
	private static final Endpoint.Rest.Type session = new Endpoint.Rest() { }
		.target(session_.class)
		.creator(session_::new)
		.template()
		.summary("Provides client session information.")
		.description("Returns information about the client using the provided th session sign-in only token.")
		.add(new Parameter("signin_token")
			.summary("The signin token")
			.description("The signin token.")
			.optional(false)
			.min(1)
			.format(Parameter.Format.TEXT))
		.build()
		.<Endpoint.Rest.Type>cast()
		.url("/oauth/session")
		.method("POST")
		;
	
	// =============================
	//
	// Authorization Endpoint
	// 
	// =============================
	
	private static class authorize_ extends Endpoint.Rest.Type
	{
		public Data process(Data params, User.Type user, Message request)
		{
			if( !request.metadata().asBool("tls") )
				throw new HttpException(400, Data.map().put("error", "invalid_request").put("error_description", "This endpoint must be called using a secure TLS connection."));
			
			if( Common.Code.count() > Common.OP_AUTH_CODE_MAX )
				throw new HttpException(400, Data.map().put("error", "invalid_request").put("error_description", "Too many pending requests (" + Common.Code.count() + ")"));

			RelyingParty.Type c = Registry.of(RelyingParty.class).get(params.asString("client_id"));
			if( c == null )
				throw new HttpException(413, Data.map().put("error", "invalid_request").put("error_description", "Invalid relying party client_id"));
			
			boolean is_openid = params.asString("scope").contains("openid");
			String response_type = params.asString("response_type");
			
			String flow = "normal";
			if( response_type.equals("token") || response_type.equals("id_token") || response_type.equals("id_token token") ) flow = "implicit";
			else flow = "hybrid";
			
			switch(response_type)
			{
				case "id_token":            // implicit
				case "id_token token":      // impliciy
				case "code id_token":       // hybrid
				case "code token":          // hybrid
				case "code id_token token": // hybrid
					if( !is_openid ) return redirectError(c, "invalid_scope", "Missing openid scope", params.asString("scope"), flow.equals("implicit"));
				case "code":                // normal
				case "token":               // implicit
					break;
				default:
					return redirectError(c, "unsupported_response_type", "Invalid response_type", params.asString("scope"), flow.equals("implicit"));
			}
			
			
			String redirectUri = params.asString("redirect_uri");
			if( !redirectUri.isBlank() && !redirectUri.equals(c.redirectUri()) )
				return redirectError(c, "invalid_request", "Invalid redirect_uri", params.asString("scope"), flow.equals("implicit"));
			else
				redirectUri = c.redirectUri();
			
			if( response_type.contains("id_token") && params.isEmpty("nonce") )
				return redirectError(c, "invalid_request", "Missing nonce", params.asString("scope"), flow.equals("implicit"));
			
			String code = Manager.of(Security.class).randomHash();
			
			Common.Code.put(code, Data.map()
				.put("scope", params.get("scope"))
				.put("client", c.id())
				.put("state", params.get("state"))
				.put("user", user.id())
				.put("response_type", response_type)
				.put("_time", System.currentTimeMillis())
				.put("nonce", params.asString("nonce"))
				.put("code_challenge", params.get("code_challenge"))
				.put("code_challenge_method", params.get("code_challenge_method"))
				.put("redirect_uri", redirectUri)
				.put("flow", flow)
				);
			
			if( user == User.ANONYMOUS )
				return redirectResponse(Common.OP_ISSUER_URL + "/oauth/ui/login?code=" + code);
			else
				return redirectResponse(Common.OP_ISSUER_URL + "/oauth/ui/consent?code=" + code);
		}
	}
	
	private static Template<? extends Endpoint.Type> authorize_ = new Endpoint.Rest() { }
		.target(authorize_.class)
		.creator(authorize_::new)
		.template()
	    .summary("OAuth authorization endpoint.")
	    .description("Handles OAuth 2.0 authorization requests based on the 'response_type', 'client_id', 'redirect_uri', 'scope', 'state', 'code_challenge', and 'code_challenge_method' parameters. The endpoint returns either a code or a token, depending on the 'response_type' parameter. Redirects with code or token depending on the 'response_type' (code 302).")
	    .add(new Parameter("response_type")
            .summary("The requested response type.")
            .description("Possible values are 'code', 'token', 'id_token', 'id_token token', 'code id_token', 'code token' and 'code id_token token'.")
            .optional(false)
            .values("code", "token", "id_token", "id_token token", "code id_token", "code token", "code id_token token")
            .format(Parameter.Format.SELECT))
	    .add(new Parameter("client_id")
            .summary("The client id")
            .description("The client id that identifies the identity provider.")
            .optional(false)
            .format(Parameter.Format.TEXT))
	    .add(new Parameter("redirect_uri")
            .summary("The redirect uri")
            .description("The redirect uri that matches the client id for verification.")
            .optional(true).defaultValue(Data.of(""))
            .format(Parameter.Format.TEXT))
	    .add(new Parameter("scope")
            .summary("The scope")
            .description("The scope of the requested grants.")
            .optional(true).defaultValue(Data.of(""))
            .format(Parameter.Format.TEXT))
	    .add(new Parameter("state")
            .summary("The internal client-side state.")
            .description("The internal client-side state.")
            .optional(true).defaultValue(Data.of(""))
            .format(Parameter.Format.TEXT))
	    .add(new Parameter("nonce")
            .summary("The ID Token nonce.")
            .description("The ID Token nonce.")
            .optional(true).defaultValue(Data.of(""))
            .format(Parameter.Format.TEXT))
	    .add(new Parameter("code_challenge")
            .summary("The code challenge")
            .description("If the identity provider requires it, the code challenge.")
            .optional(true).min(43).max(128)
            .format(Parameter.Format.TEXT))
	    .add(new Parameter("code_challenge_method")
            .summary("The code challenge method")
            .description("If the identity provider requires it, the code challenge method.")
            .optional(true).defaultValue(Data.of("plain"))
            .format(Parameter.Format.TEXT))
	    ;
		
	private static final Endpoint.Rest.Type authorize_get = authorize_
		.build()
	    .<Endpoint.Rest.Type>cast()
	    .url("/oauth/authorize")
	    .method("GET")
	    ;
		
	private static final Endpoint.Rest.Type authorize_post = authorize_
	    .build()
	    .<Endpoint.Rest.Type>cast()
	    .url("/oauth/authorize")
	    .method("POST")
	    ;
	
	// =============================
	//
	// Token Endpoint
	// 
	// =============================
	
	private static class token_ extends Endpoint.Rest.Type
	{
		public Data process(Data params, User.Type user, Message request) throws Throwable
		{
			if( !request.metadata().asBool("tls") )
				throw new HttpException(400, Data.map().put("error", "invalid_request").put("error_description", "This endpoint must be called using a secure TLS connection."));
			
			if( params.asString("grant_type").equals("authorization_code") )
				return authorization_code(params, user, request);
			else if( params.asString("grant_type").equals("password") )
				return password(params, user, request);
			else if( params.asString("grant_type").equals("client_credentials") )
				return client_credentials(params, user, request);
			else if( params.asString("grant_type").equals("refresh_token") )
				return refresh_token(params, user, request);
			else
				throw new HttpException(400, Data.map().put("error", "unsupported_grant_type").put("error_description", "Unsupported grant_type"));
		}
	
		/**
		 * 4.1.3.  Access Token Request
		 * with PKCE : https://www.rfc-editor.org/rfc/rfc7636#section-4.6
		 */
		public Data authorization_code(Data params, User.Type user, Message request) throws Throwable
		{
			String code = params.asString("code");
			String redirectUri = params.asString("redirect_uri");
			String codeVerifier = params.asString("code_verifier");
			
			if( code.isBlank() ) throw new HttpException(400, Data.map().put("error", "invalid_grant").put("error_description", "A1"));
			Data data = Common.Code.remove(code);
			if( data == null ) throw new HttpException(400, Data.map().put("error", "invalid_grant").put("error_description", "A2"));
			
			if( User.ANONYMOUS.id().equals(data.asString("user")) )
				throw new HttpException(400, Data.map().put("error", "invalid_grant").put("error_description", "A3"));
			
			if( !params.isEmpty("client_id") && !params.asString("client_id").equals(data.asString("client")) )
				throw new HttpException(400, Data.map().put("error", "invalid_grant").put("error_description", "A4"));
			
			RelyingParty.Type c = Registry.of(RelyingParty.class).get(data.asString("client"));
			if( c == null || (!redirectUri.isBlank() && !redirectUri.equals(c.redirectUri())) )
				throw new HttpException(400, Data.map().put("error", "invalid_client").put("error_description", "A5"));
			
			if( !data.isEmpty("code_challenge") || !codeVerifier.isBlank() )
			{
				if( data.asString("code_challenge_method").equals("plain") )
				{
					if( !codeVerifier.equals(data.asString("code_verifier")) )
						throw new HttpException(400, Data.map().put("error", "invalid_grant").put("error_description", "A6"));
				}
				else if( data.asString("code_challenge_method").equals("S256") )
				{
					MessageDigest md = MessageDigest.getInstance("SHA-256");
					String codeChallenge = new String(Base64.getEncoder().encode(md.digest(codeVerifier.getBytes())));
					if( !codeChallenge.equals(data.asString("code_verifier")) )
						throw new HttpException(400, Data.map().put("error", "invalid_grant").put("error_description", "A7"));
				}
				else
					throw new HttpException(400, Data.map().put("error", "invalid_grant").put("error_description", "A8"));
			}
			
			if( c == null || params.isEmpty("client_secret") || !params.asString("client_secret").equals(c.clientSecret()) )
				throw new HttpException(400, Data.map().put("error", "invalid_client").put("error_description", "A9"));
			
			user = Registry.of(User.class).get(data.asString("user"));
			if( user == null )
				throw new HttpException(400, Data.map().put("error", "invalid_grant").put("error_description", "A10"));
			
			// validate the actual scope
			String scope = validateScope(c, data.asString("scope"), user);

			long expire_in = Common.OP_ACCESS_TOKEN_TTL;
			String token = Manager.of(Security.class).generateToken(user, expire_in * 1000L, false, StringUtils.split(scope, " ")).value();
			String refreshToken = Manager.of(Security.class).randomHash();
			Data refreshState = Data.map()
				.put("client", c.id())
				.put("user", user.id())
				.put("scope", scope)
				.put("token", token)
				.put("_time", System.currentTimeMillis());
			
			Common.Refresh.put(refreshToken, refreshState);
			
			Data response = Data.map()
				.put("access_token", token)
				.put("token_type", "bearer")
				.put("expires_in", expire_in)
				.put("refresh_token", refreshToken)
				.put("scope", scope)
				;
			
			if( data.asString("scope").contains("openid") )
				response.put("id_token", generateIdToken(c, user, data.asString("nonce"), token, null));
			
			return response;
		}
	
		/**
		 * 4.3.  Resource Owner Password Credentials Grant
		 */
		public Data password(Data params, User.Type user, Message request)
		{
			String username = params.asString("username");
			String password = params.asString("password");
			String scope = params.asString("scope");
			
			if( params.isEmpty("client_id") || params.isEmpty("client_secret") )
				throw new HttpException(400, Data.map().put("error", "invalid_client").put("error_description", "P1"));
			
			RelyingParty.Type c = Registry.of(RelyingParty.class).get(params.asString("client_id"));
			if( c == null || !c.clientSecret().equals(params.asString("client_secret")) )
				throw new HttpException(400, Data.map().put("error", "invalid_client").put("error_description", "P2"));
			
			if( !c.allowPasswordGrant() )
				throw new HttpException(400, Data.map().put("error", "unauthorized_client").put("error_description", "P3"));
			
			if( username.isBlank() || password.isBlank() )
				throw new HttpException(400, Data.map().put("error", "invalid_client").put("error_description", "P4"));
			
			for( Provider.Type p : Registry.of(Provider.class) )
			{
				if( p.supports(username) )
				{
					user = p.authenticate(params);
					if( user != null && user != User.ANONYMOUS )
						break;
				}
			}
			
			if( user == null || user == User.ANONYMOUS )
				throw new HttpException(400, Data.map().put("error", "invalid_grant").put("error_description", "P5"));
			
			// validate the actual scope
			scope = validateScope(c, scope, user);
			
			long expire_in = Common.OP_ACCESS_TOKEN_TTL;
			String token = Manager.of(Security.class).generateToken(user, expire_in * 1000L, false, StringUtils.split(scope, " ")).value();
			String refreshToken = Manager.of(Security.class).randomHash();
			Data refreshState = Data.map()
				.put("client", c.id())
				.put("user", user.id())
				.put("scope", scope)
				.put("token", token)
				.put("_time", System.currentTimeMillis());
			Common.Refresh.put(refreshToken, refreshState);
			
			return Data.map()
				.put("access_token", token)
				.put("token_type", "bearer")
				.put("expires_in", expire_in)
				.put("refresh_token", refreshToken)
				.put("scope", scope)
				;
		}
	
		/**
		 * 4.4.  Client Credentials Grant
		 */
		public Data client_credentials(Data params, User.Type user, Message request)
		{
			String scope = params.asString("scope");
			
			if( params.isEmpty("client_id") || params.isEmpty("client_secret") )
				throw new HttpException(400, Data.map().put("error", "invalid_client").put("error_description", "C1"));
			
			RelyingParty.Type c = Registry.of(RelyingParty.class).get(params.asString("client_id"));
			if( c == null || !c.clientSecret().equals(params.asString("client_secret")) )
				throw new HttpException(400, Data.map().put("error", "invalid_client").put("error_description", "C2"));
			
			if( !c.allowClientCredentialsGrant() )
				throw new HttpException(400, Data.map().put("error", "unauthorized_client").put("error_description", "C3"));
			
			user = c.user();
			if( user == null || user == User.ANONYMOUS )
				throw new HttpException(400, Data.map().put("error", "invalid_grant").put("error_description", "C4"));
			
			// validate the actual scope
			scope = validateScope(c, scope, user);
			
			long expire_in = Common.OP_ACCESS_TOKEN_TTL;
			String token = Manager.of(Security.class).generateToken(user, expire_in * 1000L, false, StringUtils.split(scope, " ")).value();
			String refreshToken = Manager.of(Security.class).randomHash();
			Data refreshState = Data.map()
				.put("client", c.id())
				.put("user", user.id())
				.put("scope", scope)
				.put("token", token)
				.put("_time", System.currentTimeMillis());
			Common.Refresh.put(refreshToken, refreshState);
			
			return Data.map()
				.put("access_token", token)
				.put("token_type", "bearer")
				.put("expires_in", expire_in)
				.put("refresh_token", refreshToken)
				.put("scope", scope)
				;
		}
	
		/**
		 * 6.  Refreshing an Access Token
		 */
		public Data refresh_token(Data params, User.Type user, Message request)
		{
			String refreshToken = params.asString("refresh_token");
			String scope = params.asString("scope");
			
			Data data = Common.Refresh.remove(refreshToken);
			if( data == null )
				throw new HttpException(400, Data.map().put("error", "invalid_grant").put("error_description", "R1"));
			
			RelyingParty.Type c = Registry.of(RelyingParty.class).get(data.asString("client"));
			if( c == null )
				throw new HttpException(400, Data.map().put("error", "invalid_client").put("error_description", "R2"));
			
			if( scope.isBlank() )
				scope = data.asString("scope");
			else if( !scope.equals(data.asString("scope")) )
				throw new HttpException(400, Data.map().put("error", "invalid_scope").put("error_description", "R3"));
			
			// revoke the old token
			Manager.of(Security.class).revokeToken(Manager.of(Security.class).authenticate(data.asString("token"), false));
			
			user = Registry.of(User.class).get(data.asString("user"));
			if( user == null )
				throw new HttpException(400, Data.map().put("error", "invalid_grant").put("error_description", "R4"));
			
			long expire_in = Common.OP_ACCESS_TOKEN_TTL;
			String token = Manager.of(Security.class).generateToken(user, expire_in * 1000L, false, StringUtils.split(scope, " ")).value();
			String newRefreshToken = Manager.of(Security.class).randomHash();
			Data newRefreshState = Data.map()
				.put("client", c.id())
				.put("user", user.id())
				.put("scope", scope)
				.put("token", token)
				.put("_time", System.currentTimeMillis());
			Common.Refresh.put(newRefreshToken, newRefreshState);
			
			return Data.map()
				.put("access_token", token)
				.put("token_type", "bearer")
				.put("expires_in", expire_in)
				.put("refresh_token", newRefreshToken)
				.put("scope", scope)
				;
		}
	}
	
	private static final Endpoint.Rest.Type token = new Endpoint.Rest() { }
		.target(token_.class)
		.creator(token_::new)
	    .template()
	    .summary("OAuth token endpoint.")
	    .description("Handles OAuth 2.0 token requests. The endpoint is responsible for issuing tokens based on the 'grant_type', 'client_id', and 'client_secret' parameters. Supported grant types include 'authorization_code', 'password', 'client_credentials', and 'refresh_token'. Returns a JSON object containing the access token (code 200), or an error if the request is invalid.")
	    .add(new Parameter("grant_type")
            .summary("The authorization grant type.")
            .description("Must be one of 'authorization_code', 'password', 'client_credentials', or 'refresh_token'.")
            .optional(false)
            .values("authorization_code", "password", "client_credentials", "refresh_token")
            .format(Parameter.Format.SELECT))
	    .add(new Parameter("client_id")
            .summary("The client id")
            .description("The client id that identifies the identity provider.")
            .optional(true).defaultValue(Data.of(""))
            .format(Parameter.Format.TEXT))
	    .add(new Parameter("client_secret")
            .summary("The client secret")
            .description("The client secret that matches the client_id.")
            .optional(true).defaultValue(Data.of(""))
            .format(Parameter.Format.TEXT))
	    .add(new Parameter("code")
            .summary("The code")
            .description("The code to use in the authorization_code grant type.")
            .optional(true)
            .format(Parameter.Format.TEXT))
	    .add(new Parameter("redirect_uri")
            .summary("The redirect uri")
            .description("The redirect_uri that matches the registered provider for verification in the authorization_code grant type.")
            .optional(true).defaultValue(Data.of(""))
            .format(Parameter.Format.TEXT))
	    .add(new Parameter("code_verifier")
            .summary("The code verifier")
            .description("The code verifier in the authorization_code grant type in case the code_challenge is activated for that provider.")
            .optional(true).min(43).max(128)
            .format(Parameter.Format.TEXT))
	    .add(new Parameter("username")
            .summary("The username")
            .description("The username in case of a password grant type.")
            .optional(true)
            .format(Parameter.Format.TEXT))
	    .add(new Parameter("password")
            .summary("The password")
            .description("The password in case of a password grant type.")
            .optional(true)
            .format(Parameter.Format.TEXT))
	    .add(new Parameter("scope")
            .summary("The scope")
            .description("The scope in case of a password, refresh_token or client_credentials grant type.")
            .optional(true)
            .format(Parameter.Format.TEXT))
	    .add(new Parameter("refresh_token")
            .summary("The refresh token")
            .description("The refresh token to renew the associated token in case of a refresh_token grant type")
            .optional(true)
            .format(Parameter.Format.TEXT))
	    .build()
	    .<Endpoint.Rest.Type>cast()
	    .url("/oauth/token")
	    .method("POST")
	    ;
	
	// =============================
	//
	// Revoke Token Endpoint
	// 
	// =============================
		
	private static class revoke_ extends Endpoint.Rest.Type
	{
		/**
		 * 2.  Token Revocation
		 * https://www.rfc-editor.org/rfc/rfc7009
		 */
		public Data process(Data params, User.Type user, Message request)
		{
			if( !request.metadata().asBool("tls") )
				throw new HttpException(400, Data.map().put("error", "invalid_request").put("error_description", "This endpoint must be called using a secure TLS connection."));
			
			if( params.isEmpty("client_id") || params.isEmpty("client_secret") )
				throw new HttpException(400, Data.map().put("error", "invalid_client").put("error_description", "X1"));
			
			RelyingParty.Type c = Registry.of(RelyingParty.class).get(params.asString("client_id"));
			if( c == null || !c.clientSecret().equals(params.asString("client_secret")) )
				throw new HttpException(400, Data.map().put("error", "invalid_client").put("error_description", "X2"));
			
			String token = params.asString("token");
			
			// first try refresh token
			Data refreshState = Common.Refresh.get(token);
			if( refreshState != null )
			{
				if( !c.id().equals(refreshState.asString("client")) )
					throw new HttpException(400, Data.map().put("error", "invalid_grant").put("error_description", "X3"));
				Common.Refresh.remove(token);
			}
			
			// second try regular token
			Manager.of(Security.class).revokeToken(Manager.of(Security.class).authenticate(token, false));
			
			throw new HttpException(200);
		}
	}
	
	private static final Endpoint.Rest.Type revoke = new Endpoint.Rest() {}
		.target(revoke_.class)
		.creator(revoke_::new)
	    .template()
	    .summary("OAuth token revocation endpoint.")
	    .description("Handles OAuth 2.0 token revocation. This endpoint allows the client to revoke their own tokens. The client_id and client_secret must match, and the token to be revoked is provided in the request. Returns an empty response (code 200) or an error (code 400) in case of failure.")
	    .add(new Parameter("client_id")
            .summary("The client_id")
            .description("The client_id that identifies the author of the token.")
            .optional(true).defaultValue(Data.of(""))
            .format(Parameter.Format.TEXT))
	    .add(new Parameter("client_secret")
            .summary("The client_secret")
            .description("The client_secret that matches the client_id.")
            .optional(true).defaultValue(Data.of(""))
            .format(Parameter.Format.TEXT))
	    .add(new Parameter("token")
            .summary("The token")
            .description("The token to revoke.")
            .optional(false)
            .format(Parameter.Format.TEXT))
	    .build()
	    .<Endpoint.Rest.Type>cast()
	    .url("/oauth/revoke")
	    .method("POST")
	    ;
	    
	public static void register()
	{
		// calling this method will force initialization of all private static members
		// all endpoints will be added to the registry automatically
	}
}
