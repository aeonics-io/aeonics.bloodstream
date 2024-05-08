package aeonics.oidc;

import aeonics.data.Data;
import aeonics.entity.Action;
import aeonics.entity.Registry;
import aeonics.entity.security.Provider;
import aeonics.http.Endpoint;
import aeonics.http.Endpoint.Rest;
import aeonics.template.Parameter;

public class Endpoints
{
	public static void register(Action.Type router)
	{
		router.addRelation("endpoints", providers);
	}
	
	private static final Endpoint.Rest.Type providers = new Endpoint.Rest() { }
		.template()
		.summary("Lists the authentication providers enabled for the specified user")
		.description("This endpoint returns the lists of authentication providers enabled for the specified login.")
		.add(new Parameter("login").optional(true).min(1).max(100)
			.summary("The user login")
			.description("The user login.")
			)
		.build()
		.<Rest.Type>cast()
		.process((parameters) ->
		{
			Data list = Data.list();
			
			if( parameters.isEmpty("login") )
			{
				// return all remote providers
				for( Provider.Type p : Registry.of(Provider.class) )
				{
					if( p instanceof Provider.Remote )
					{
						list.add(Data.map()
							.put("id", p.id())
							.put("name", p.name())
							.put("login_redirect", ((Provider.Remote)p).loginPageRedirectUrl()));
					}
				}
			}
			else
			{
				// return only the providers that support this user
				for( Provider.Type p : Registry.of(Provider.class) )
				{
					if( p.supports(parameters.asString("login")) )
					{
						list.add(Data.map()
							.put("id", p.id())
							.put("name", p.name())
							.put("login_redirect", p instanceof Provider.Remote ? ((Provider.Remote)p).loginPageRedirectUrl() : null));
					}
				}
			}
			
			return list;
		})
		.url("/oidc/providers")
		.method("GET")
		;
}
