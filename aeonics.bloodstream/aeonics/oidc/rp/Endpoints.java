package aeonics.oidc.rp;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.Signature;
import java.time.ZoneOffset;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.util.Base64;

import aeonics.entity.Message;
import aeonics.entity.Registry;
import aeonics.entity.security.Provider;
import aeonics.entity.security.User;
import aeonics.http.Endpoint;
import aeonics.http.HttpException;
import aeonics.manager.Config;
import aeonics.manager.Logger;
import aeonics.manager.Manager;
import aeonics.manager.Security;
import aeonics.oidc.Common;
import aeonics.oidc.op.OidcProvider;
import aeonics.template.Parameter;
import aeonics.util.Http;
import aeonics.util.Json;
import aeonics.util.StringUtils;
import aeonics.data.Data;

@SuppressWarnings("unused")
public class Endpoints 
{
	private Endpoints() { /* no instances */ }
	
	/**
	 * Builds a redirect http error response
	 * @param location the target location
	 * @return the redirect data
	 */
	private static Data redirectError(String error, String description)
	{
		return Data.map()
			.put("isHttpResponse", true)
			.put("code", 302)
			.put("headers", Data.map().put("Location",
				Common.OP_ISSUER_URL + "/oauth/ui/error" +
				"?error=" + (error == null ? "server_error" : error) +
				"&error_description=" + java.net.URLEncoder.encode(description == null ? "" : description, StandardCharsets.ISO_8859_1)));
	}

	/**
	 * Returns the web origin (scheme and host) serving this request, used as this RP's own origin.
	 * @param request the incoming request
	 * @return the origin (e.g. "https://example.com") or null if the host is unknown
	 */
	private static String requestOrigin(Message request)
	{
		String host = request.content().get("headers").asString("host");
		if( host == null || host.isBlank() ) return null;
		return (request.metadata().asBool("tls") ? "https://" : "http://") + host;
	}

	/**
	 * Builds a redirect back to the origin that initiated the login, carrying only the error code.
	 * The referer trust is established when the relay state is created, not here.
	 * @param referer the origin captured at login initiation
	 * @param error the error code to surface
	 * @return the redirect data
	 */
	private static Data redirectOrigin(String referer, String error)
	{
		String fragment = "";
		int hash = referer.indexOf('#');
		if( hash >= 0 ) { fragment = referer.substring(hash); referer = referer.substring(0, hash); }

		String location = referer
			+ (referer.indexOf('?') < 0 ? "?" : "&")
			+ "oidc_error=" + java.net.URLEncoder.encode(error == null ? "server_error" : error, StandardCharsets.UTF_8)
			+ fragment;

		return Data.map()
			.put("isHttpResponse", true)
			.put("code", 302)
			.put("headers", Data.map().put("Location", location));
	}

	/**
	 * Builds a plain 302 redirect to the given location.
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

	/**
	 * Surfaces an error back to the initiating client once the relay state is recovered.
	 * PKCE clients receive an OAuth-style error on their registered redirect_uri; cookie-path
	 * clients are sent back to their origin with an oidc_error marker.
	 * @param relayState the recovered relay state
	 * @param error the error code to surface
	 * @return the redirect data
	 */
	private static Data redirectClientError(Data relayState, String error)
	{
		if( !relayState.isEmpty("app_client") )
		{
			String redirect = relayState.asString("app_redirect");
			String location = redirect
				+ (redirect.indexOf('?') < 0 ? "?" : "&")
				+ "error=" + URLEncoder.encode(error == null ? "server_error" : error, StandardCharsets.UTF_8);
			if( !relayState.isEmpty("app_state") )
				location += "&state=" + URLEncoder.encode(relayState.asString("app_state"), StandardCharsets.UTF_8);
			return redirectResponse(location);
		}
		else
			return redirectOrigin(relayState.asString("referer"), error);
	}

	/**
	 * Verifies a PKCE code_verifier against a stored code_challenge.
	 * @param method the challenge method, "S256" or "plain"
	 * @param verifier the code_verifier presented at redemption
	 * @param challenge the code_challenge stored at initiation
	 * @return true if the verifier matches the challenge
	 */
	private static boolean verifyPkce(String method, String verifier, String challenge) throws Exception
	{
		if( verifier == null || verifier.isBlank() || challenge == null || challenge.isBlank() ) return false;
		if( "plain".equals(method) )
			return MessageDigest.isEqual(verifier.getBytes(StandardCharsets.US_ASCII), challenge.getBytes(StandardCharsets.US_ASCII));

		MessageDigest md = MessageDigest.getInstance("SHA-256");
		String computed = Base64.getUrlEncoder().withoutPadding().encodeToString(md.digest(verifier.getBytes(StandardCharsets.US_ASCII)));
		return MessageDigest.isEqual(computed.getBytes(StandardCharsets.US_ASCII), challenge.getBytes(StandardCharsets.US_ASCII));
	}

	/**
	 * Checks the input jwt and returns the decoded payload
	 * @param jwt
	 * @return
	 */
	private static Data checkJwt(OidcProvider.Type provider, String jwt) throws Exception
	{
		String[] parts = StringUtils.split(jwt, ".");
		if( parts.length != 3 ) throw new RuntimeException("Invalid JWT");
		
		int sigoffset = jwt.lastIndexOf('.');
		Data header = Json.decode(new String(Base64.getUrlDecoder().decode(parts[0].getBytes()), StandardCharsets.UTF_8));
		
		if( !header.asString("alg").equals("RS256") ) throw new RuntimeException("Unsupported JWT alg : " + header.asString("alg"));
		Signature signature = Signature.getInstance("SHA256withRSA");
		signature.initVerify(provider.publicKey(header.asString("kid")));
		signature.update(jwt.getBytes(), 0, sigoffset);
		
		byte[] sig = Base64.getUrlDecoder().decode(parts[2]);
		if( !signature.verify(sig) )
			throw new SecurityException("Invalid JWT signature");
		
		return Json.decode(new String(Base64.getUrlDecoder().decode(parts[1]), StandardCharsets.UTF_8));
	}
	
	private static class login_ extends Endpoint.Rest.Type
	{
		public Data process(Data params, User.Type user, Message request)
		{
			try
			{
				if( !request.metadata().asBool("tls") ) return redirectError("invalid_state", "Unsecure connection");
				
				String provider = params.asString("provider");
				
				if( provider == null || provider.isBlank() ) return redirectError("invalid_state", "Invalid security provider");
				
				Provider.Type p = Registry.of(Provider.class).get(provider);
				if( !(p instanceof OidcProvider.Type) ) return redirectError("invalid_state", "Incompatible security provider");
				
				if( Common.Code.count() > Manager.of(Config.class).get(Security.class, "oidc.op.auth_code.max").asInt() )return redirectError("server_error", "Too many pending requests (" + Common.Code.count() + ")");

				Data relayState = Data.map()
					.put("provider", provider)
					.put("_time", System.currentTimeMillis());

				String challenge = params.asString("code_challenge");
				if( challenge != null && !challenge.isBlank() )
				{
					// PKCE path: the token is delivered to a registered app, not the referer
					Data app = Common.App.get(params.asString("client_id"));
					if( app == null ) return redirectError("invalid_request", "Unknown client_id");

					String method = params.asString("code_challenge_method");
					if( method == null || method.isBlank() ) method = "S256";
					if( !method.equals("S256") && !method.equals("plain") ) return redirectError("invalid_request", "Unsupported code_challenge_method");

					relayState
						.put("app_client", params.asString("client_id"))
						.put("app_redirect", app.asString("redirect_uri"))
						.put("code_challenge", challenge)
						.put("code_challenge_method", method)
						.put("app_state", params.asString("state"));
				}
				else
				{
					// cookie path: the token is delivered back to the trusted origin that initiated the login
					String referer = request.content().get("headers").asString("referer");
					String origin = requestOrigin(request);
					if( origin == null || referer == null || (!referer.equals(origin) && !referer.startsWith(origin + "/")) )
						return redirectError("invalid_state", "Untrusted origin");

					relayState.put("referer", referer);
				}

				String state = "ae-" + Manager.of(Security.class).randomHash();
				Common.Code.put(state, relayState);
					
				return Data.map()
					.put("isHttpResponse", true)
					.put("code", 302)
					.put("headers", Data.map().put("Location", 
						((OidcProvider.Type)p).autorizeUrl() + "?response_type=code" 
						+ "&client_id=" + java.net.URLEncoder.encode(((OidcProvider.Type)p).clientId(), StandardCharsets.UTF_8)
						+ "&redirect_uri=" + java.net.URLEncoder.encode(((OidcProvider.Type)p).redirectUri(), StandardCharsets.UTF_8)
						+ "&scope=openid%20email"
						+ "&state=" + state
						));
			}
			catch(Exception e)
			{
				Manager.of(Logger.class).info(OidcProvider.class, e);
				return redirectError("server_error", e.getMessage());
			}
		}
	}
	
	private static final Endpoint.Rest.Type login = new Endpoint.Rest() { }
		.target(login_.class)
		.creator(login_::new)
		.template()
		.summary("Initiate OpenID login.")
		.description("Initiates the connection request to an external OpenID Provider. Without a code_challenge the resulting token is delivered as a cookie to the trusted origin that initiated the login. With a code_challenge the flow uses PKCE and the token is delivered, via a one-time code, to the redirect_uri registered for the given client_id.")
		.add(new Parameter("provider")
			.summary("The OpenID provider")
			.description("The ID of the OpenID provider.")
			.optional(false)
			.rule(Parameter.Rule.ID)
			.format(Parameter.Format.TEXT))
		.add(new Parameter("client_id")
			.summary("The app client id")
			.description("The id of the registered application that will receive the token. Required when using PKCE (code_challenge).")
			.optional(true)
			.format(Parameter.Format.TEXT))
		.add(new Parameter("code_challenge")
			.summary("The PKCE code challenge")
			.description("The PKCE code challenge. When provided, the flow switches from the cookie delivery to the PKCE code delivery.")
			.optional(true).min(43).max(128)
			.format(Parameter.Format.TEXT))
		.add(new Parameter("code_challenge_method")
			.summary("The PKCE code challenge method")
			.description("The PKCE code challenge method, 'S256' (default) or 'plain'.")
			.optional(true).defaultValue("S256")
			.format(Parameter.Format.TEXT))
		.add(new Parameter("state")
			.summary("The app state")
			.description("Opaque value echoed back to the app redirect_uri for CSRF/correlation on the app side.")
			.optional(true).defaultValue("")
			.format(Parameter.Format.TEXT))
		.create()
		.<Endpoint.Rest.Type>cast()
		.url("/oidc/login")
		.method("GET")
		;
	
	private static class response_ extends Endpoint.Rest.Type
	{
		public Data process(Data params, User.Type user, Message request)
		{
			try
			{
				if( !request.metadata().asBool("tls") ) return redirectError("invalid_state", "Unsecure connection");

				String state = params.asString("state");
				if( state == null || state.isBlank() ) return redirectError("invalid_state", "Invalid OIDC state");

				Data relayState = Common.Code.remove(state);
				if( relayState == null || (relayState.isEmpty("referer") && relayState.isEmpty("app_client")) ) return redirectError("invalid_state", "Missing or expired request");

				// instance-local app: a single leading-slash path is resolved against the local issuer
				if( !relayState.isEmpty("app_client") )
				{
					String appRedirect = relayState.asString("app_redirect");
					if( appRedirect.startsWith("/") )
					{
						if( appRedirect.length() > 1 && (appRedirect.charAt(1) == '/' || appRedirect.charAt(1) == '\\') )
							return redirectError("invalid_request", "Invalid redirect_uri");
						relayState.put("app_redirect", Common.OP_ISSUER_URL + appRedirect);
					}
				}

				if( !params.isEmpty("error") ) return redirectClientError(relayState, params.asString("error"));

				String code = params.asString("code");
				if( code == null || code.isBlank() ) return redirectClientError(relayState, "invalid_code");

				Provider.Type p = Registry.of(Provider.class).get(relayState.asString("provider"));
				if( !(p instanceof OidcProvider.Type) ) return redirectClientError(relayState, "invalid_state");
				OidcProvider.Type op = ((OidcProvider.Type)p);

				String tokenUrl = op.tokenUrl();
				Data response = null;

				try
				{
					response = Http.post(tokenUrl, Data.map()
						.put("grant_type", "authorization_code")
						.put("code", code)
						.put("redirect_uri", op.redirectUri())
						.put("client_id", op.clientId())
						.put("client_secret", op.clientSecret())
						, null, "POST", 0, tokenUrl.startsWith(Common.OP_ISSUER_URL) ? Http.trustAll() : null);
				}
				catch(Http.Error e)
				{
					Data body = Json.decode(e.body);
					return redirectClientError(relayState, body.isMap() ? body.asString("error") : "server_error");
				}

				Data jwt = null;
				try { jwt = checkJwt(op, response.asString("id_token")); }
				catch(Exception e) { return redirectClientError(relayState, "invalid_token"); }

				// if we arrive here, it means the JWT from the relying party was successful
				// so we automatically join the response user to our provider
				user = op.join(jwt, null);
				if( user == null || user == User.ANONYMOUS ) return redirectClientError(relayState, "invalid_token");

				String token = null;
				if( jwt.asString("iss").equals(Common.OP_ISSUER_URL) )
					token = response.asString("access_token");
				else
					token = Manager.of(Security.class).generateToken(user, Common.OP_ACCESS_TOKEN_TTL * 1000L, true, "topic", "http").value();

				if( !relayState.isEmpty("app_client") )
				{
					// PKCE path: deliver a one-time code to the registered redirect_uri; the app
					// exchanges it for the token at /oidc/token, so the token never transits the url
					String appCode = Manager.of(Security.class).randomHash();
					Common.AppCode.put(appCode, Data.map()
						.put("token", token)
						.put("client", relayState.asString("app_client"))
						.put("redirect_uri", relayState.asString("app_redirect"))
						.put("code_challenge", relayState.asString("code_challenge"))
						.put("code_challenge_method", relayState.asString("code_challenge_method"))
						.put("_time", System.currentTimeMillis()));

					String redirect = relayState.asString("app_redirect");
					String location = redirect
						+ (redirect.indexOf('?') < 0 ? "?" : "&")
						+ "code=" + appCode;
					if( !relayState.isEmpty("app_state") )
						location += "&state=" + URLEncoder.encode(relayState.asString("app_state"), StandardCharsets.UTF_8);
					return redirectResponse(location);
				}

				// cookie path: deliver the token to the trusted origin that initiated the login
				String referer = relayState.asString("referer");
				int start_host = referer.indexOf("//")+2;
				int start_path = referer.indexOf("/", start_host);
				int end_path = referer.indexOf("/", start_path+1);
				String hostname = referer.substring(start_host, start_path > 0 ? start_path : referer.length());
				String path = start_path < 0 ? "/" : referer.substring(start_path, end_path > 0 ? end_path : referer.length());
				
				return Data.map()
					.put("isHttpResponse", true)
					.put("code", 302)
					.put("headers", Data.map().put("Location", referer)
						.put("Set-Cookie", 
						"token=" + URLEncoder.encode(token, StandardCharsets.UTF_8) + 
					 	// if no domain, then the current domain is used.
						// ";domain=" + hostname +
						";SameSite=Lax" +
						";Secure" +
						";max-age=" + Common.OP_ACCESS_TOKEN_TTL +
						";expires=" + DateTimeFormatter.RFC_1123_DATE_TIME.format(ZonedDateTime.now(ZoneOffset.UTC).plusSeconds(Common.OP_ACCESS_TOKEN_TTL)) +
						";path=" + path));
			}
			catch(Exception e)
			{
				Manager.of(Logger.class).info(OidcProvider.class, e);
				return redirectError("server_error", e.getMessage());
			}
		}
	}
	
	private static final Endpoint.Rest.Type response = new Endpoint.Rest() { }
		.target(response_.class)
		.creator(response_::new)
		.template()
		.summary("Handle OpenID response.")
		.description("Handles the response from an external OpenID Provider.")
		.add(new Parameter("state")
			.summary("Internal state")
			.description("The opaque authentication state that was used during initiation of the login request.")
			.optional(true)
			.format(Parameter.Format.TEXT))
		.add(new Parameter("code")
			.summary("Authentication code")
			.description("The authorization code generated by the OpenID provider.")
			.optional(true)
			.format(Parameter.Format.TEXT))
		.add(new Parameter("error")
			.summary("Error code")
			.description("The eventual error code.")
			.optional(true)
			.format(Parameter.Format.TEXT))
		.add(new Parameter("error_description")
			.summary("Error description")
			.description("The eventual error description.")
			.optional(true)
			.format(Parameter.Format.TEXT))
		.create()
		.<Endpoint.Rest.Type>cast()
		.url("/oidc/response")
		.method("GET")
		;

	// =============================
	//
	// PKCE token redemption (public clients)
	//
	// =============================

	private static class token_ extends Endpoint.Rest.Type
	{
		public Data process(Data params, User.Type user, Message request)
		{
			if( !request.metadata().asBool("tls") )
				throw new HttpException(400, Data.map().put("error", "invalid_request").put("error_description", "This endpoint must be called using a secure TLS connection."));

			String code = params.asString("code");
			if( code == null || code.isBlank() )
				throw new HttpException(400, Data.map().put("error", "invalid_grant").put("error_description", "Missing code"));

			Data data = Common.AppCode.get(code);
			if( data == null )
				throw new HttpException(400, Data.map().put("error", "invalid_grant").put("error_description", "Invalid code"));

			// single use: consume the code before validating the verifier so that a stolen
			// code cannot be used to brute force the verifier across multiple attempts
			Common.AppCode.remove(code);

			if( System.currentTimeMillis() - data.asLong("_time") > Common.OP_AUTH_CODE_TTL * 1000L )
				throw new HttpException(400, Data.map().put("error", "invalid_grant").put("error_description", "Expired code"));

			if( !data.asString("client").equals(params.asString("client_id")) )
				throw new HttpException(400, Data.map().put("error", "invalid_client").put("error_description", "Client mismatch"));

			boolean ok;
			try { ok = verifyPkce(data.asString("code_challenge_method"), params.asString("code_verifier"), data.asString("code_challenge")); }
			catch(Exception e) { ok = false; }
			if( !ok )
				throw new HttpException(400, Data.map().put("error", "invalid_grant").put("error_description", "Invalid code_verifier"));

			return Data.map()
				.put("access_token", data.asString("token"))
				.put("token_type", "bearer")
				.put("expires_in", Common.OP_ACCESS_TOKEN_TTL);
		}
	}

	private static final Endpoint.Rest.Type token = new Endpoint.Rest() { }
		.target(token_.class)
		.creator(token_::new)
		.template()
		.summary("Exchange a PKCE authorization code for a token.")
		.description("Redeems a one-time authorization code issued to a registered public client for the associated access token, validating the PKCE code_verifier. No client secret is required.")
		.add(new Parameter("client_id")
			.summary("The app client id")
			.description("The id of the registered application redeeming the code.")
			.optional(false)
			.format(Parameter.Format.TEXT))
		.add(new Parameter("code")
			.summary("The authorization code")
			.description("The one-time authorization code received on the redirect_uri.")
			.optional(false)
			.format(Parameter.Format.TEXT))
		.add(new Parameter("code_verifier")
			.summary("The PKCE code verifier")
			.description("The PKCE code verifier matching the code_challenge sent at login initiation.")
			.optional(false).min(43).max(128)
			.format(Parameter.Format.TEXT))
		.create()
		.<Endpoint.Rest.Type>cast()
		.url("/oidc/token")
		.method("POST")
		;

	// =============================
	//
	// App registration (admin only, gated by the /api/admin policy)
	//
	// =============================

	private static final Endpoint.Rest.Type appRegister = new Endpoint.Rest() { }
		.template()
		.summary("Register an application.")
		.description("Registers a public client application that may receive tokens from this relying party via PKCE. Returns the client_id and redirect_uri.")
		.add(new Parameter("client_id")
			.summary("The client id")
			.description("The desired client id. A random one is generated when omitted. Reusing an existing id updates that registration.")
			.optional(true).defaultValue("")
			.format(Parameter.Format.TEXT))
		.add(new Parameter("redirect_uri")
			.summary("The redirect uri")
			.description("The exact redirect URI that will receive the authorization code. Either a full http(s) URL, or a single leading-slash path for an instance-local app, in which case the current instance host is prepended at redirect time.")
			.optional(false)
			.format(Parameter.Format.TEXT))
		.add(new Parameter("name")
			.summary("The application name")
			.description("A human readable name for the application.")
			.optional(true).defaultValue("")
			.format(Parameter.Format.TEXT))
		.create()
		.<Endpoint.Rest.Type>cast()
		.process((params) ->
		{
			String redirectUri = params.asString("redirect_uri");
			boolean fullUrl = redirectUri != null && (redirectUri.startsWith("https://") || redirectUri.startsWith("http://"));
			boolean localPath = redirectUri != null && redirectUri.startsWith("/") && !(redirectUri.length() > 1 && (redirectUri.charAt(1) == '/' || redirectUri.charAt(1) == '\\'));
			if( !fullUrl && !localPath )
				throw new HttpException(422, "Invalid redirect_uri");

			String clientId = params.asString("client_id");
			if( clientId == null || clientId.isBlank() ) clientId = Manager.of(Security.class).randomHash();

			Common.App.put(clientId, Data.map()
				.put("client_id", clientId)
				.put("redirect_uri", redirectUri)
				.put("name", params.asString("name"))
				.put("_time", System.currentTimeMillis()));

			return Data.map().put("client_id", clientId).put("redirect_uri", redirectUri);
		})
		.url("/api/admin/oidc/app")
		.method("POST")
		;

	private static final Endpoint.Rest.Type appList = new Endpoint.Rest() { }
		.template()
		.summary("List registered applications.")
		.description("Returns the list of registered public client applications.")
		.create()
		.<Endpoint.Rest.Type>cast()
		.process((params, user) -> Common.App.list())
		.url("/api/admin/oidc/app")
		.method("GET")
		;

	private static final Endpoint.Rest.Type appDelete = new Endpoint.Rest() { }
		.template()
		.summary("Delete a registered application.")
		.description("Removes a registered public client application.")
		.add(new Parameter("client_id")
			.summary("The client id")
			.description("The id of the application to remove.")
			.optional(false)
			.format(Parameter.Format.TEXT))
		.create()
		.<Endpoint.Rest.Type>cast()
		.process((params, user) ->
		{
			Common.App.remove(params.asString("client_id"));
			return null;
		})
		.url("/api/admin/oidc/app")
		.method("DELETE")
		;

	public static void register()
	{
		// calling this method will force initialization of all private static members
		// all endpoints will be added to the registry automatically
	}
}
