package aeonics.endpoint.meta;

import aeonics.data.Data;
import aeonics.entity.security.User;
import aeonics.http.Endpoint;
import aeonics.http.Endpoint.Rest;
import aeonics.manager.Config;
import aeonics.manager.Manager;
import aeonics.template.Parameter;

@SuppressWarnings("unused")
public class Configuration
{
	private Configuration() { /* no instances */ }
	
	public static void register()
	{
		// calling this method will force initialization of all private static members
		// all endpoints will be added to the registry automatically
	}
	
	private static final Endpoint.Rest.Type list = new Endpoint.Rest() { }
		.template()
		.summary("List configuration parameters")
		.description("This endpoint returns the list of configuration parameters and their value. The list can be filtered to a specific entity type.")
		.add(new Parameter("entity")
			.summary("Entity filter")
			.description("The entity filter allows to return all configuration parameters related to a specific entity type. If not specified, all entity types a returned.")
			.format(Parameter.Format.TEXT)
			.optional(true)
			.defaultValue(Data.empty()))
		.build()
		.<Rest.Type>cast()
		.process((params, user) ->
		{
			Data list;
			if( !params.isEmpty("entity") )
				list = Data.map().put(params.asString("entity"), Manager.of(Config.class).all(params.asString("entity")));
			else
				list = Data.of(Manager.of(Config.class).all());
			
			Data configs = Data.list();
			list.entrySet().forEach((e) -> {
				String entity = e.getKey();
				e.getValue().entrySet().forEach((value) -> {
					String name = value.getKey();
					configs.add(Data.map()
						.put("entity", entity)
						.put("name", name)
						.put("value", value.getValue())
						.put("definition", Manager.of(Config.class).definition(entity, name))
					);
				});
			});
			
			return configs;
		})
		.url("/api/admin/config/list")
		.method("GET")
		;
	
	private static final Endpoint.Rest.Type get = new Endpoint.Rest() { }
		.template()
		.summary("Get a configuration parameter value")
		.description("This endpoint returns the current value of a specific configuration parameter. If not found, the value is null.")
		.add(new Parameter("entity")
			.summary("Entity type")
			.description("The specific entity type.")
			.format(Parameter.Format.TEXT)
			.optional(false))
		.add(new Parameter("name")
			.summary("Name")
			.description("The configuration parameter name.")
			.format(Parameter.Format.TEXT)
			.optional(false))
		.build()
		.<Rest.Type>cast()
		.process((params, user) ->
		{
			return Manager.of(Config.class).get(params.asString("entity"), params.asString("name"));
		})
		.url("/api/admin/config/{entity}/{name}")
		.method("GET")
		;
	
	private static final Endpoint.Rest.Type remove = new Endpoint.Rest() { }
		.template()
		.summary("Remove a configuration parameter")
		.description("This endpoint removes a configuration parameter and all associated value.")
		.add(new Parameter("entity")
			.summary("Entity type")
			.description("The specific entity type.")
			.format(Parameter.Format.TEXT)
			.optional(false))
		.add(new Parameter("name")
			.summary("Name")
			.description("The configuration parameter name.")
			.format(Parameter.Format.TEXT)
			.optional(false))
		.build()
		.<Rest.Type>cast()
		.process((params, user) ->
		{
			Manager.of(Config.class).remove(params.asString("entity"), params.asString("name"));
			return null;
		})
		.url("/api/admin/config/{entity}/{name}")
		.method("DELETE")
		;
	
	private static final Endpoint.Rest.Type set = new Endpoint.Rest() { }
		.template()
		.summary("Set a configuration parameter value")
		.description("This endpoint overrides the current value of a specific configuration parameters. "
				+ "If the specified parameter does not exist, it is created implicitly. "
				+ "If the value is not specified, the original value is replaced by null.")
		.add(new Parameter("entity")
			.summary("Entity type")
			.description("The specific entity type.")
			.format(Parameter.Format.TEXT)
			.optional(false))
		.add(new Parameter("name")
			.summary("Name")
			.description("The configuration parameter name.")
			.format(Parameter.Format.TEXT)
			.optional(false))
		.add(new Parameter("value")
			.summary("Value")
			.description("The configuration parameter value.")
			.format(Parameter.Format.TEXT)
			.optional(true)
			.defaultValue(Data.empty()))
		.build()
		.<Rest.Type>cast()
		.process((params, user) ->
		{
			Manager.of(Config.class).set(params.asString("entity"), params.asString("name"), params.get("value"));
			return null;
		})
		.url("/api/admin/config/{entity}/{name}")
		.method("POST")
		;
		
	private static final Endpoint.Rest.Type def = new Endpoint.Rest() { }
		.template()
		.summary("Describe a configuration parameter")
		.description("This endpoint returns the definition a specific configuration parameter. The definition may be null if it is not specified or the configuration parameter does not exist.")
		.add(new Parameter("entity")
			.summary("Entity type")
			.description("The specific entity type.")
			.format(Parameter.Format.TEXT)
			.optional(false))
		.add(new Parameter("name")
			.summary("Name")
			.description("The configuration parameter name.")
			.format(Parameter.Format.TEXT)
			.optional(false))
		.build()
		.<Rest.Type>cast()
		.process((params, user) ->
		{
			return Data.of(Manager.of(Config.class).definition(params.asString("entity"), params.asString("name")));
		})
		.url("/api/admin/config/definition/{entity}/{name}")
		.method("GET")
		;
}
