package aeonics.endpoint.meta;

import java.util.List;

import aeonics.Boot;
import aeonics.Plugin;
import aeonics.data.Data;
import aeonics.entity.Action;
import aeonics.entity.Entity;
import aeonics.entity.Registry;
import aeonics.http.Endpoint;
import aeonics.http.Endpoint.Rest;
import aeonics.http.HttpException;
import aeonics.manager.Manager;
import aeonics.template.Factory;
import aeonics.template.Parameter;
import aeonics.template.Relationship;
import aeonics.template.Template;
import aeonics.util.Hardware;
import aeonics.util.Json;
import aeonics.util.StringUtils;
import aeonics.util.Tuple;

public class Endpoints 
{
	private static String ROOT = "/api/meta/";
	
	public static void register(Action.Type router)
	{
		router.addRelation("endpoints", registry_entities);
		router.addRelation("endpoints", registry_categories);
		
		router.addRelation("endpoints", template);
		router.addRelation("endpoints", factory_templates);
		router.addRelation("endpoints", factory_categories);
		
		router.addRelation("endpoints", plugins);
		router.addRelation("endpoints", managers);
		router.addRelation("endpoints", system);
		router.addRelation("endpoints", overview);
		
		router.addRelation("endpoints", entity_get);
		router.addRelation("endpoints", entity_remove);
		router.addRelation("endpoints", entity_add);
		router.addRelation("endpoints", entity_update);
	}
	
	private static final Endpoint.Rest.Type registry_entities = new Endpoint.Rest() { }
		.template()
		.summary("Lists entities in the registry")
		.description("This endpoint returns the name and id of all entities in the specified category.")
		.add(new Parameter("category").optional(false).min(1).max(100)
			.summary("The entity category")
			.description("The entity category.")
			)
		.build()
		.<Rest.Type>cast()
		.process((parameters) ->
		{
			Data list = Data.list();
			for( Entity e : Registry.of(parameters.asString("category")) )
			{
				Data related = Data.list();
				for( Tuple<List<Data>, Relationship> t : e.relationships().values() )
					for( Data d : t.a )
						related.add(d.asString("id"));
				
				list.add(Data.map().put("id", e.id()).put("name", e.name()).put("type", e.type()).put("relations", related));
			}
			return list;
		})
		.url(ROOT + "registry/entities")
		.method("GET")
		;
		
	private static final Endpoint.Rest.Type registry_categories = new Endpoint.Rest() { }
		.template()
		.summary("Lists registry categories")
		.description("This endpoint returns the name of all registry categories.")
		.build()
		.<Rest.Type>cast()
		.process(() ->
		{
			Data list = Data.list();
			for( Registry<?> r : Registry.all() )
				list.add(r.category());
			return list;
		})
		.url(ROOT + "registry/categories")
		.method("GET")
		;
		
	private static final Endpoint.Rest.Type template = new Endpoint.Rest() { }
		.template()
		.summary("Describe a template")
		.description("This endpoint returns the description of the specified template.")
		.add(new Parameter("category").optional(false).min(1).max(100)
			.summary("The template category")
			.description("The template category.")
			)
		.add(new Parameter("type").optional(false).min(1).max(100)
			.summary("The template entity type")
			.description("The template entity type.")
			)
		.build()
		.<Rest.Type>cast()
		.process((parameters) ->
		{
			if( !Factory.has(parameters.asString("category")) )
				throw new HttpException(404);
			
			Template<?> t = Factory.of(parameters.asString("category")).get(parameters.asString("type"));
			if( t == null )
				throw new HttpException(404);
			
			return t.export(); 
		})
		.url(ROOT + "template")
		.method("GET")
		;
	
	private static final Endpoint.Rest.Type factory_templates = new Endpoint.Rest() { }
		.template()
		.summary("Lists templates in the factory")
		.description("This endpoint returns the entity type and target of all templates in the specified category.")
		.add(new Parameter("category").optional(false).min(1).max(100)
			.summary("The template category")
			.description("The template category.")
			)
		.build()
		.<Rest.Type>cast()
		.process((parameters) ->
		{
			Data list = Data.list();
			for( Template<?> t : Factory.of(parameters.asString("category")) )
			{
				list.add(Data.map()
					.put("type", StringUtils.toLowerCase(t.type()))
					.put("target", StringUtils.toLowerCase(t.target()))
					.put("name", t.name())
					.put("plugin", t.type().getModule().getName())
					);
			}
			return list;
		})
		.url(ROOT + "factory/templates")
		.method("GET")
		;
		
	private static final Endpoint.Rest.Type factory_categories = new Endpoint.Rest() { }
		.template()
		.summary("Lists factory categories")
		.description("This endpoint returns the name of all factory categories.")
		.build()
		.<Rest.Type>cast()
		.process(() ->
		{
			Data list = Data.list();
			for( Factory<?> f : Factory.all() )
				list.add(f.category());
			return list;
		})
		.url(ROOT + "factory/categories")
		.method("GET")
		;
	
	private static final Endpoint.Rest.Type plugins = new Endpoint.Rest() { }
		.template()
		.summary("Lists plugins")
		.description("This endpoint returns the name of all plugins and shared libraries.")
		.build()
		.<Rest.Type>cast()
		.process(() ->
		{
			Data list = Data.list().add(Boot.class.getModule().getName());
			for( String p : Plugin.all() )
				list.add(p);
			return list;
		})
		.url(ROOT + "plugins")
		.method("GET")
		;
		
	private static final Endpoint.Rest.Type managers = new Endpoint.Rest() { }
		.template()
		.summary("Lists managers")
		.description("This endpoint returns the list of all registered managers.")
		.build()
		.<Rest.Type>cast()
		.process(() ->
		{
			Data list = Data.map();
			for( Manager.Type p : Manager.all() )
				list.put(StringUtils.toLowerCase(p.manager()), p.id());
			return list;
		})
		.url(ROOT + "managers")
		.method("GET")
		;
	
	private static final Endpoint.Rest.Type system = new Endpoint.Rest() { }
		.template()
		.summary("Lists system metrics")
		.description("This endpoint returns various system and hardware metrics.")
		.build()
		.<Rest.Type>cast()
		.process(() ->
		{
			Data info = Hardware.export().put("system", Data.map()
				.put("version", Boot.VERSION)
				.put("boot", Boot.BOOT_TIME)
				.put("jvm", Runtime.version())
				);
			return info;
		})
		.url(ROOT + "system")
		.method("GET")
		;
		
	private static final Endpoint.Rest.Type overview = new Endpoint.Rest() { }
		.template()
		.summary("Full system overview")
		.description("Returns a full system overview including the plugins, managers, registry and factory.")
		.build()
		.<Rest.Type>cast()
		.process(() ->
		{
			try
			{
				Data registry = Data.map();
				for( Data category : registry_categories.process() )
					registry.put(category.asString(), registry_entities.process(Data.map().put("category", category)));
				
				Data factory = Data.map();
				for( Data category : factory_categories.process() )
					factory.put(category.asString(), factory_templates.process(Data.map().put("category", category)));
				
				Data info = Data.map()
					.put("plugins", plugins.process())
					.put("managers", managers.process())
					.put("registry", registry)
					.put("factory", factory)
					;
				return info;
			}
			catch(Throwable e) { throw new RuntimeException(e); }
		})
		.url(ROOT + "overview")
		.method("GET")
		;
	
	private static final Endpoint.Rest.Type entity_get = new Endpoint.Rest() { }
		.template()
		.summary("Fetches an entity")
		.description("This endpoint returns the description of the specified entity.")
		.add(new Parameter("category").optional(false).min(1).max(100)
			.summary("The entity category")
			.description("The entity category.")
			)
		.add(new Parameter("id").optional(false).rule(Parameter.ID)
			.summary("The entity id")
			.description("The entity id.")
			)
		.build()
		.<Rest.Type>cast()
		.process((parameters) ->
		{
			if( !Registry.has(parameters.asString("category")) )
				throw new HttpException(404);
			
			Entity e = Registry.of(parameters.asString("category")).get(parameters.asString("id"));
			if( e == null )
				throw new HttpException(404);
			
			return e.export(); 
		})
		.url(ROOT + "entity/{category}/{id}")
		.method("GET")
		;
		
	public static final Endpoint.Rest.Type entity_remove = new Endpoint.Rest() { }
		.template()
		.summary("Removes an entity")
		.description("This endpoint removes the specified entity.")
		.add(new Parameter("category").optional(false).min(1).max(100)
			.summary("The entity category")
			.description("The entity category.")
			)
		.add(new Parameter("id").optional(false).rule(Parameter.ID)
			.summary("The entity id")
			.description("The entity id.")
			)
		.build()
		.<Rest.Type>cast()
		.process((parameters) ->
		{
			if( !Registry.has(parameters.asString("category")) )
				throw new HttpException(404);
			
			Entity e = Registry.of(parameters.asString("category")).remove(parameters.asString("id"));
			if( e == null )
				throw new HttpException(404);
			
			return null; 
		})
		.url(ROOT + "entity/{category}/{id}")
		.method("DELETE");
	
	public static final Endpoint.Rest.Type entity_add = new Endpoint.Rest() { }
		.template()
		.summary("Creates an entity")
		.description("This endpoint creates a new entity with the provided data.")
		.add(new Parameter("category").optional(false).min(1).max(100)
			.summary("The entity category")
			.description("The entity category.")
			)
		.add(new Parameter("type").optional(false).min(1).max(100)
			.summary("The entity type")
			.description("The entity type.")
			)
		.add(new Parameter("data").optional(false)
			.summary("The entity data")
			.description("The entity data. It should always be a json object.")
			)
		.build()
		.<Rest.Type>cast()
		.process((parameters) ->
		{
			if( !Registry.has(parameters.asString("category")) )
				throw new HttpException(404);
			
			if( !parameters.isMap("data") )
				parameters.put("data", Json.decode(parameters.asString("data")));
			if( !parameters.isMap("data") )
				throw new HttpException(413, "Input data must be a json object");
			
			Template<?> t = Factory.of(parameters.asString("category")).get(parameters.asString("type"));
			if( t == null )
				throw new HttpException(413, "Unknown entity template");
			
			Entity e = Registry.add(t.build(parameters.get("data")));
			return Data.map().put("id", e.id());
		})
		.url(ROOT + "entity/{category}/{type}")
		.method("POST");
	
	public static final Endpoint.Rest.Type entity_update = new Endpoint.Rest() { }
		.template()
		.summary("Updates an entity")
		.description("This endpoint updates the specified entity with the provided data.")
		.add(new Parameter("category").optional(false).min(1).max(100)
			.summary("The entity category")
			.description("The entity category.")
			)
		.add(new Parameter("id").optional(false).rule(Parameter.ID)
			.summary("The entity id")
			.description("The entity id.")
			)
		.add(new Parameter("data").optional(false)
			.summary("The entity data")
			.description("The entity data. It should always be a json object.")
			)
		.build()
		.<Rest.Type>cast()
		.process((parameters) ->
		{
			if( !Registry.has(parameters.asString("category")) )
				throw new HttpException(404);
			
			Entity e = Registry.of(parameters.asString("category")).get(parameters.asString("id"));
			if( e == null )
				throw new HttpException(404);
			
			if( !parameters.isMap("data") )
				parameters.put("data", Json.decode(parameters.asString("data")));
			if( !parameters.isMap("data") )
				throw new HttpException(413, "Input data must be a json object");
			
			Factory.of(e).modify(parameters.get("data"), e);
			return null; 
		})
		.url(ROOT + "entity/{category}/{id}")
		.method("PUT");
}
