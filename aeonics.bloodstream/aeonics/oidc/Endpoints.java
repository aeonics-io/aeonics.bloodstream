package aeonics.oidc;

import aeonics.data.Data;
import aeonics.entity.Registry;
import aeonics.entity.security.Provider;
import aeonics.http.Endpoint;
import aeonics.http.Endpoint.Rest;
import aeonics.manager.Config;
import aeonics.manager.Manager;
import aeonics.manager.Security;
import aeonics.template.Parameter;

@SuppressWarnings("unused")
public class Endpoints
{
	private Endpoints() { /* no instances */ }
	
	public static void register()
	{
		// calling this method will force initialization of all private static members
		// all endpoints will be added to the registry automatically
	}
	
	
	private static final Endpoint.Rest.Type local = new Endpoint.Rest() { }
		.template()
		.summary("Returns the id of the local identity provider")
		.description("This endpoint returns the id of the local identity provider.")
		.create()
		.<Rest.Type>cast()
		.process((parameters) ->
		{
			Provider.Type provider = Registry.of(Provider.class).get(Manager.of(Config.class).get(Security.class, "local.provider").asString());
			return Data.map()
				.put("id", provider.id())
				.put("name", provider.name())
				.put("login_redirect", ((Provider.Remote)provider).loginPageRedirectUrl());
		})
		.url("/oidc/local")
		.method("GET")
		;
	
	private static final Endpoint.Rest.Type providers = new Endpoint.Rest() { }
		.template()
		.summary("Lists the authentication providers enabled for the specified user")
		.description("This endpoint returns the lists of authentication providers enabled for the specified login.")
		.add(new Parameter("login").optional(true).min(1).max(100)
			.summary("The user login")
			.description("The user login.")
			.format(Parameter.Format.TEXT)
			)
		.create()
		.<Rest.Type>cast()
		.process((parameters) ->
		{
			Data list = Data.list();
			
			boolean all = parameters.isEmpty("login");
			
			for( Provider.Type p : Registry.of(Provider.class) )
			{
				if( all || p.supports(parameters.asString("login")) )
				{
					list.add(Data.map()
						.put("id", p.id())
						.put("name", p.name())
						.put("login_redirect", p instanceof Provider.Remote ? ((Provider.Remote)p).loginPageRedirectUrl() : null));
				}
			}
			
			return list;
		})
		.url("/oidc/providers")
		.method("GET")
		;
}
