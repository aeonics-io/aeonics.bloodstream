package aeonics.oidc.rp;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.security.Signature;
import java.time.ZoneOffset;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.util.Base64;

import aeonics.entity.Action;
import aeonics.entity.Message;
import aeonics.entity.Registry;
import aeonics.entity.security.Provider;
import aeonics.entity.security.User;
import aeonics.http.Endpoint;
import aeonics.http.Endpoint.Rest;
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

public class Endpoints 
{
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
				"?error=" + error + 
				"&error_description=" + java.net.URLEncoder.encode(description, StandardCharsets.ISO_8859_1)));
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
		Data header = Json.decode(new String(Base64.getDecoder().decode(parts[0].getBytes()), StandardCharsets.UTF_8));
		
		if( !header.asString("alg").equals("RS256") ) throw new RuntimeException("Unsupported JWT alg : " + header.asString("alg"));
		Signature signature = Signature.getInstance("SHA256withRSA");
		signature.initVerify(provider.publicKey(header.asString("kid")));
		signature.update(jwt.getBytes(), 0, sigoffset);
		if( !signature.verify(jwt.getBytes(), sigoffset+1, jwt.length()-sigoffset-1) )
			throw new SecurityException("Invalid JWT signature");
		
		return Json.decode(new String(Base64.getDecoder().decode(parts[1].getBytes()), StandardCharsets.UTF_8));
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
				if( !request.content().get("headers").asString("referer").startsWith(Common.OP_ISSUER_URL) ) return redirectError("invalid_state", "Invalid referer");
				
				Provider.Type p = Registry.of(Provider.class).get(provider);
				if( !(p instanceof OidcProvider.Type) ) return redirectError("invalid_state", "Incompatible security provider");
				
				if( Common.Code.count() > Manager.of(Config.class).get("security.code.pending.max").asInt() ) return redirectError("server_error", "Too many pending requests (" + Common.Code.count() + ")");
				
				String state = "ae-" + Manager.of(Security.class).randomHash();
				Data relayState = Data.map()
					.put("provider", provider)
					.put("referer", request.content().get("headers").asString("referer"))
					.put("_time", System.currentTimeMillis());
				
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
		.description("Initiates the connection request to an external OpenID Provider. The response will be sent to the referer provided that it points to this instance.")
		.add(new Parameter("provider")
			.summary("The OpenID provider")
			.description("The ID of the OpenID provider.")
			.optional(false)
			.rule(Parameter.ID))
		.build()
		.<Endpoint.Rest.Type>cast()
		.url("/oidc/login")
		.method("POST")
		;
	
	private static class response_ extends Endpoint.Rest.Type
	{
		public Data process(Data params, User.Type user, Message request)
		{
			try {
			Data relayState = null;
			String state = null, code = null;
			
			if( !request.metadata().asBool("tls") ) return redirectError("invalid_state", "Unsecure connection");
			
			if( !params.isEmpty("error") ) return redirectError(params.asString("error"), params.asString("error_description"));
			
			state = params.asString("state");
			if( state == null || state.isBlank() ) return redirectError("invalid_state", "Invalid OIDC state");
				
			code = params.asString("code");
			if( code == null || state.isBlank() ) return redirectError("invalid_code", "Invalid OIDC code");
				
			relayState = Common.Code.remove(state);
			if( relayState == null ) return redirectError("invalid_state", "Missing or expired request");
			
			Provider.Type p = Registry.of(Provider.class).get(relayState.asString("provider"));
			if( !(p instanceof OidcProvider.Type) ) return redirectError("invalid_state", "Incompatible security provider");
			OidcProvider.Type op = ((OidcProvider.Type)p);
			
			String tokenUrl = op.tokenUrl();
			Data response = null;
			
			try
			{
				response = Http.post(tokenUrl,Data.map()
					.put("grant_type", "authorization_code")
					.put("code", code)
					.put("redirect_uri", op.redirectUri())
					.put("client_id", op.clientId())
					.put("client_secret", op.clientSecret())
					);
			}
			catch(Http.Error e)
			{
				Data body = Json.decode(e.body);
				return redirectError(body.asString("error"), body.asString("error_description"));
			}
			
			Data jwt = null;
			
			try { jwt = checkJwt(op, response.asString("id_token")); }
			catch(Exception e) { return redirectError("invalid_token", e.getMessage()); }
			
			user = op.authenticate(jwt);
			if( user == null || user == User.ANONYMOUS ) return redirectError("invalid_token", "Failed to authenticate");
			
			String token = null;
			if( jwt.asString("iss").equals(Common.OP_ISSUER_URL) )
				token = response.asString("access_token");
			else
				token = Manager.of(Security.class).generateToken(user, Common.OP_ACCESS_TOKEN_TTL, true, "topic", "http").value();
			
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
				 	";domain=" + hostname +
					";SameSite=Lax" +
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
			.optional(false))
		.add(new Parameter("code")
			.summary("Authentication code")
			.description("The authorization code generated by the OpenID provider.")
			.optional(true))
		.add(new Parameter("error")
			.summary("Error code")
			.description("The eventual error code.")
			.optional(true))
		.add(new Parameter("error_description")
			.summary("Error description")
			.description("The eventual error description.")
			.optional(true))
		.build()
		.<Endpoint.Rest.Type>cast()
		.url("/oidc/response")
		.method("GET")
		;
	
	private static final Endpoint.Rest.Type providers = new Endpoint.Rest() { }
		.template()
		.summary("Lists the authentication providers enabled for the specified user")
		.description("This endpoint returns the lists of authentication providers enabled for the specified login.")
		.add(new Parameter("login").optional(false).min(1).max(100)
			.summary("The user login")
			.description("The user login.")
			)
		.build()
		.<Rest.Type>cast()
		.process((parameters) ->
		{
			Data list = Data.list();
			for( Provider.Type p : Registry.of(Provider.class) )
				if( p.supports(parameters.asString("login")) )
					list.add(p.export());
			return list;
		})
		.url("/oidc/providers")
		.method("GET")
		;
	public static void register(Action.Type router)
	{
		router.addRelation("endpoints", login);
		router.addRelation("endpoints", response);
		router.addRelation("endpoints", providers);
	}
}
