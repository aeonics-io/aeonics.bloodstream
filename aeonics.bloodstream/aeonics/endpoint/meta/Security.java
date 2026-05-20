package aeonics.endpoint.meta;

import java.util.Collection;
import java.util.stream.StreamSupport;

import aeonics.data.Data;
import aeonics.entity.Entity;
import aeonics.entity.Registry;
import aeonics.entity.security.Group;
import aeonics.entity.security.Multifactor;
import aeonics.entity.security.Provider;
import aeonics.entity.security.Token;
import aeonics.entity.security.User;
import aeonics.http.Endpoint;
import aeonics.http.HttpException;
import aeonics.manager.Manager;
import aeonics.oidc.TOTP;
import aeonics.template.Parameter;
import aeonics.util.Json;
import aeonics.util.StringUtils;
import aeonics.util.Tuples.Tuple;
import aeonics.http.Endpoint.Rest;

@SuppressWarnings("unused")
public class Security 
{
	private Security() { /* no instances */ }
	
	public static void register()
	{
		// calling this method will force initialization of all private static members
		// all endpoints will be added to the registry automatically
	}
	
	private static final Endpoint.Rest.Type me = new Endpoint.Rest() { }
		.template()
		.summary("Retrieves current user's information.")
		.description("This endpoint returns the identity of the authenticated user.")
		.create()
		.<Rest.Type>cast()
		.process((params, user) ->
		{
			Data roles = Data.list();
			for( Tuple<Entity, Data> r : user.relations("roles") )
			{
				if( r.a != null )
					roles.add(Data.map().put("name", r.a.name()).put("id", r.a.id()));
			}
			
			Data groups = Data.list();
			for( Tuple<Entity, Data> g : user.relations("groups") )
			{
				if( g.a != null )
				{
					groups.add(Data.map().put("name", g.a.name()).put("id", g.a.id()));
					
					for( Tuple<Entity, Data> r : g.a.relations("roles") )
					{
						if( r.a != null && roles.find(d -> d.get("id").equals(r.a.id())) == null )
							roles.add(Data.map().put("name", r.a.name()).put("id", r.a.id()));
					}
				}
			}
			
			return Data.map()
				.put("id", user.id())
				.put("name", user.name())
				.put("login", user.login())
				.put("active", user.active())
				.put("attributes", user.valueOf("attributes"))
				.put("anonymous", user == User.ANONYMOUS)
				.put("groups", groups)
				.put("roles", roles)
				.put("mfa", StreamSupport.stream(Registry.of(Multifactor.class).spliterator(), false).anyMatch(m -> m.enrolled(user)));
		})
		.url("/api/security/me")
		.method("GET")
		;
	
	private static final Endpoint.Rest.Type logout = new Endpoint.Rest() { }
		.template()
		.summary("Logout and invalidate the current token.")
		.description("This endpoint logs out the user by invalidating the current associated tokens.")
		.create()
		.<Rest.Type>cast()
		.process((params, user, request) ->
		{
			if( user != User.ANONYMOUS && !request.metadata().isEmpty("token") )
				Manager.of(aeonics.manager.Security.class).revokeToken(request.metadata().get("token").get());
			return Data.map().put("success", true);
		})
		.url("/api/security/logout")
		.method("POST")
		;

	private static final Endpoint.Rest.Type check = new Endpoint.Rest() { }
		.template()
		.summary("Check security permissions")
		.description("This endpoint checks if the currently authenticated user has explicit permissions (allowed or denied) for a given scope, considering additional constraints (context) if provided.")
		.add(new Parameter("scope")
			.summary("Scope of the security context")
			.description("Usually the scope matches a user role. However, there might be other application-specific scopes applicable.")
			.optional(true)
			.format(Parameter.Format.TEXT)
			.defaultValue("topic"))
		.add(new Parameter("context")
			.summary("Specific security context")
			.description("The security context is a key-value pair of settings and parameters that are specific for each scope.")
			.optional(true)
			.rule(Parameter.Rule.JSON_MAP)
			.format(Parameter.Format.JSON)
			.defaultValue(Data.map()))
		.create()
		.<Rest.Type>cast()
		.process((params, user, request) ->
		{
			if( !params.isMap("context") )
				params.put("context", Json.decode(params.asString("context")));
			if( !params.isMap("context") )
				throw new HttpException(422, "Invalid context");
			
			boolean denied = Manager.of(aeonics.manager.Security.class).isExplicitlyDenied(user, params.asString("scope"), params.get("context"));
			boolean allowed = Manager.of(aeonics.manager.Security.class).isExplicitlyAllowed(user, params.asString("scope"), params.get("context"));
			boolean granted = allowed && !denied;
			
			return Data.map()
				.put("denied", denied)
				.put("allowed", allowed)
				.put("granted", granted)
				.put("id", user.id())
				.put("name", user.name())
				.put("anonymous", user == User.ANONYMOUS);
		})
		.url("/api/security/check")
		.method("POST")
		;
		
	private static final Endpoint.Rest.Type selfPassword = new Endpoint.Rest() { }
		.template()
		.summary("Change password")
		.description("This endpoint can be used to change the current user password. All user tokens are invalidated.")
		.add(new Parameter("current_password")
			.summary("Current password")
			.description("The current user password for verification")
			.format(Parameter.Format.TEXT)
			.optional(false))
		.add(new Parameter("password")
			.summary("Password")
			.description("The new user password")
			.format(Parameter.Format.TEXT)
			.optional(false))
		.create()
		.<Rest.Type>cast()
		.process((data, user) ->
		{
			Provider.Type provider = Registry.of(Provider.class).get(p -> p.type().equals(StringUtils.toLowerCase(Provider.Local.class)));
			if( provider == null ) throw new HttpException(500, "Security provider unavailable");

			// verify current password
			User.Type check = provider.authenticate(Data.map().put("username", user.login()).put("password", data.asString("current_password")));
			if( check == null || !check.id().equals(user.id()) ) throw new HttpException(403, "Invalid current password");

			// leave and rejoin
			provider.leave(user);
			provider.join(Data.map().put("password", data.asString("password")).put("username", user.login()), user);
			
			// invalidate all tokens
			Manager.of(aeonics.manager.Security.class).clearTokens(user);
			
			return Data.map().put("success", true);
		})
		.url("/api/security/me")
		.method("PATCH")
		;
	
	private static final Endpoint.Rest.Type selfName = new Endpoint.Rest() { }
		.template()
		.summary("Update user")
		.description("This endpoint can be used to change the current user display name. In case of duplicates, an error is returned.")
		.add(new Parameter("name")
			.summary("Name")
			.description("The new user display name")
			.format(Parameter.Format.TEXT)
			.max(200).min(1)
			.optional(false))
		.create()
		.<Rest.Type>cast()
		.process((data, user) ->
		{
			if( Registry.of(User.class).get(data.asString("name")) != null )
				throw new HttpException(400, "Duplicate user display name");
			
			user.name(data.asString("name"));
			
			return Data.map().put("success", true);
		})
		.url("/api/security/me")
		.method("POST")
		;
		
	private static final Endpoint.Rest.Type selfReset = new Endpoint.Rest() { }
		.template()
		.summary("Reset OTP")
		.description("This endpoint can be used to reset the OTP of the current user.")
		.add(new Parameter("otp")
			.summary("OTP")
			.description("The current OTP code is required as proof of ownership.")
			.optional(false)
			.format(Parameter.Format.TEXT))
		.create()
		.<Rest.Type>cast()
		.process((data, user) ->
		{
			if( !Multifactor.check(user, data) )
				throw new HttpException(403, "OTP code mismatch");

			for( Multifactor.Type m : Registry.of(Multifactor.class) )
				m.forget(user);

			return Data.map().put("success", true);
		})
		.url("/api/security/me/otp")
		.method("DELETE")
		;
		
	private static final Endpoint.Rest.Type selfTokenList = new Endpoint.Rest() { }
		.template()
		.summary("Fetch all api keys")
		.description("This endpoint returns all bearer tokens currently active for the current user.")
		.add(new Parameter("scopes")
			.summary("Scopes")
			.description("Optional list of token scopes to match (JSON list)")
			.format(Parameter.Format.JSON)
			.rule(Parameter.Rule.JSON_LIST)
			.optional(true))
		.create()
		.<Rest.Type>cast()
		.process((data, user) ->
		{
			Data scopes = data.get("scopes");
			
			Data result = Data.list();
			Manager.of(aeonics.manager.Security.class)
				.listTokens(user)
				.stream()
				.filter(t ->
				{
					if( !t.isValid() ) return false;
					if( scopes.isEmpty() ) return true;
					for( Data s : scopes )
						if( !t.inScope(s.asString()) )
							return false;
					return true;
				})
				.forEach(t -> result.add(t.export()));
				
			return result;
		})
		.url("/api/security/me/token")
		.method("GET")
		;
		
	private static final Endpoint.Rest.Type selfTokenGenerate = new Endpoint.Rest() { }
		.template()
		.summary("Generate api key")
		.description("This endpoint generates and returns a bearer token (api key) for the current user with the specified scopes.")
		.add(new Parameter("scopes")
			.summary("Scopes")
			.description("List of token scopes to include in the token")
			.format(Parameter.Format.JSON)
			.rule(Parameter.Rule.JSON_LIST)
			.optional(false))
		.add(new Parameter("validity")
			.summary("Validity")
			.description("Time based validity for this token in milliseconds. A value <= 0 means unlimited. Default value is 0")
			.format(Parameter.Format.NUMBER)
			.rule(Parameter.Rule.INTEGER)
			.optional(true)
			.defaultValue(0))
		.create()
		.<Rest.Type>cast()
		.process((data, user) ->
		{
			Data scopes = data.get("scopes");
			if( scopes.isEmpty() ) throw new HttpException(400, "Missing scopes");
			String[] list = new String[scopes.size()];
			for( int i = 0; i < list.length; i++ )
				list[i] = scopes.asString(i);
			
			Token token = Manager.of(aeonics.manager.Security.class).generateToken(user, data.asLong("validity"), false, list);
			
			return Data.map().put("token", token.export());
		})
		.url("/api/security/me/token")
		.method("POST")
		;
		
	private static final Endpoint.Rest.Type selfTokenRemove = new Endpoint.Rest() { }
		.template()
		.summary("Remove api key")
		.description("This endpoint removes the specified token for the current user.")
		.add(new Parameter("token")
			.summary("Token")
			.description("The token to remove")
			.format(Parameter.Format.TEXT)
			.rule(Parameter.Rule.HEXA)
			.optional(false))
		.create()
		.<Rest.Type>cast()
		.process((data, user) ->
		{
			Collection<Token> tokens = Manager.of(aeonics.manager.Security.class).listTokens(user);
			Token token = tokens.stream()
				.filter(t -> t.value().equals(data.asString("token")))
				.findFirst()
				.orElse(null);
			
			if( token != null )
				Manager.of(aeonics.manager.Security.class).revokeToken(token);
			
			return Data.map().put("success", true);
		})
		.url("/api/security/me/token")
		.method("DELETE")
		;
		
	private static final Endpoint.Rest.Type selfTokenRotate = new Endpoint.Rest() { }
		.template()
		.summary("Rotate api key")
		.description("This endpoint rotates the specified token for the current user, the new value is returned.")
		.add(new Parameter("token")
			.summary("Token")
			.description("The token to rotate")
			.format(Parameter.Format.TEXT)
			.rule(Parameter.Rule.HEXA)
			.optional(false))
		.create()
		.<Rest.Type>cast()
		.process((data, user) ->
		{
			Collection<Token> tokens = Manager.of(aeonics.manager.Security.class).listTokens(user);
			Token token = tokens.stream()
				.filter(t -> t.value().equals(data.asString("token")))
				.findFirst()
				.orElse(null);
			
			if( token == null )
				throw new HttpException(400, "Invalid token");
			
			Token rotate = Manager.of(aeonics.manager.Security.class).generateToken(user, token.validity(), false, token.scopes().toArray(new String[0]));
			Manager.of(aeonics.manager.Security.class).revokeToken(token);
			
			return Data.map().put("token", rotate.export());
		})
		.url("/api/security/me/token")
		.method("PATCH")
		;
}
