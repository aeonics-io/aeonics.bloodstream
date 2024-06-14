package aeonics.endpoint.meta;

import aeonics.data.Data;
import aeonics.entity.Action;
import aeonics.entity.security.User;
import aeonics.http.Endpoint;
import aeonics.http.HttpException;
import aeonics.manager.Manager;
import aeonics.template.Parameter;
import aeonics.util.Json;
import aeonics.http.Endpoint.Rest;

public class Security 
{
	private Security() { /* no instances */ }
	
	public static void register(Action.Type router)
	{
		router.addRelation("endpoints", me);
		router.addRelation("endpoints", check);
		router.addRelation("endpoints", logout);
	}
	
	private static final Endpoint.Rest.Type me = new Endpoint.Rest() { }
		.template()
		.summary("Retrieves current user's information.")
		.description("This endpoint returns the identity of the authenticated user.")
		.build()
		.<Rest.Type>cast()
		.process((params, user) ->
		{
			return Data.map()
				.put("id", user.id())
				.put("name", user.name())
				.put("anonymous", user == User.ANONYMOUS);
		})
		.url("/api/security/me")
		.method("GET")
		;
	
	private static final Endpoint.Rest.Type logout = new Endpoint.Rest() { }
		.template()
		.summary("Logout and invalidate the current token.")
		.description("This endpoint logs out the user by invalidating the current associated tokens.")
		.build()
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
			.defaultValue(Data.of("topic")))
		.add(new Parameter("context")
			.summary("Specific security context")
			.description("The security context is a key-value pair of settings and parameters that are specific for each scope.")
			.optional(true)
			.rule(Parameter.JSON_MAP)
			.defaultValue(Data.map()))
		.build()
		.<Rest.Type>cast()
		.process((params, user, request) ->
		{
			if( !params.isMap("context") )
				params.put("context", Json.decode(params.asString("context")));
			if( !params.isMap("context") )
				throw new HttpException(413, "Invalid context");
			
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
}
