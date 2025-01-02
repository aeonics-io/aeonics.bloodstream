package aeonics.endpoint.meta;

import java.io.InputStream;
import java.lang.management.ManagementFactory;
import java.lang.management.ThreadInfo;
import java.lang.management.ThreadMXBean;
import java.lang.module.ModuleDescriptor.*;
import java.lang.module.ModuleReference;
import java.lang.module.ResolvedModule;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.ZonedDateTime;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

import aeonics.Boot;
import aeonics.Plugin;
import aeonics.data.Data;
import aeonics.entity.Entity;
import aeonics.entity.Flow;
import aeonics.entity.Probe;
import aeonics.entity.Registry;
import aeonics.entity.Storage;
import aeonics.http.Endpoint;
import aeonics.http.Endpoint.Rest;
import aeonics.http.HttpException;
import aeonics.manager.Config;
import aeonics.manager.Executor;
import aeonics.manager.Logger;
import aeonics.manager.Manager;
import aeonics.manager.Monitor;
import aeonics.template.Factory;
import aeonics.template.Parameter;
import aeonics.template.Relationship;
import aeonics.template.Template;
import aeonics.util.Hardware;
import aeonics.util.Json;
import aeonics.util.StringUtils;
import aeonics.util.Tuples.Tuple;

@SuppressWarnings("unused")
public class Endpoints 
{
	private Endpoints() { /* no instances */ }
	
	private static final String ROOT = "/api/meta/";
	
	public static void register()
	{
		// calling this method will force initialization of all private static members
		// all endpoints will be added to the registry automatically
	}
	
	private static final Endpoint.Rest.Type registry_entities = new Endpoint.Rest() { }
		.template()
		.summary("Lists entities in the registry")
		.description("This endpoint returns all entities in the specified category.")
		.add(new Parameter("category").optional(false).min(1).max(100)
			.summary("The entity category")
			.description("The entity category.")
			.format(Parameter.Format.TEXT)
			)
		.create()
		.<Rest.Type>cast()
		.process((parameters) ->
		{
			Data list = Data.list();
			for( Entity e : Registry.of(parameters.asString("category")) )
				list.add(e.export());
			return list;
		})
		.url(ROOT + "registry/{category}/entities")
		.method("GET")
		;
		
	private static final Endpoint.Rest.Type registry_categories = new Endpoint.Rest() { }
		.template()
		.summary("Lists registry categories")
		.description("This endpoint returns the name of all registry categories.")
		.create()
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
			.format(Parameter.Format.TEXT)
			)
		.add(new Parameter("type").optional(false).min(1).max(100)
			.summary("The template entity type")
			.description("The template entity type.")
			.format(Parameter.Format.TEXT)
			)
		.create()
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
		.url(ROOT + "template/{category}/{type}")
		.method("GET")
		;
	
	private static final Endpoint.Rest.Type entity_template = new Endpoint.Rest() { }
		.template()
		.summary("Describe the template of an entity")
		.description("This endpoint returns the description of the template from the specified entity.")
		.add(new Parameter("category").optional(false).min(1).max(100)
			.summary("The entity category")
			.description("The entity category.")
			.format(Parameter.Format.TEXT)
			)
		.add(new Parameter("id").optional(false)
			.summary("The entity id")
			.description("The entity id.")
			.format(Parameter.Format.TEXT)
			)
		.create()
		.<Rest.Type>cast()
		.process((parameters) ->
		{
			if( !Registry.has(parameters.asString("category")) )
				throw new HttpException(404);
			
			Entity e = Registry.of(parameters.asString("category")).get(parameters.asString("id"));
			if( e == null )
				throw new HttpException(404);
			
			if( !Factory.has(parameters.asString("category")) )
				throw new HttpException(404);
			
			Template<?> t = Factory.of(parameters.asString("category")).get(e.type());
			if( t == null )
				throw new HttpException(404);
			
			return t.export(); 
		})
		.url(ROOT + "entity/template/{category}/{id}")
		.method("GET")
		;
	
	private static final Endpoint.Rest.Type factory_templates = new Endpoint.Rest() { }
		.template()
		.summary("Lists templates in the factory")
		.description("This endpoint returns the entity type and target of all templates in the specified category.")
		.add(new Parameter("category").optional(false).min(1).max(100)
			.summary("The template category")
			.description("The template category.")
			.format(Parameter.Format.TEXT)
			)
		.create()
		.<Rest.Type>cast()
		.process((parameters) ->
		{
			Data list = Data.list();
			for( Template<?> t : Factory.of(parameters.asString("category")) )
				list.add(t.export());
			return list;
		})
		.url(ROOT + "factory/{category}/templates")
		.method("GET")
		;
		
	private static final Endpoint.Rest.Type factory_categories = new Endpoint.Rest() { }
		.template()
		.summary("Lists factory categories")
		.description("This endpoint returns the name of all factory categories.")
		.create()
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
		.description("This endpoint returns the name of all compatible plugins.")
		.create()
		.<Rest.Type>cast()
		.process(() ->
		{
			Data list = Data.list();
			for( Plugin p : Plugin.all() )
				list.add(Data.map().put("name", p.name()).put("summary", p.summary()).put("description", p.description()));
			return list;
		})
		.url(ROOT + "plugins")
		.method("GET")
		;
		
	private static final Endpoint.Rest.Type managers = new Endpoint.Rest() { }
		.template()
		.summary("Lists managers")
		.description("This endpoint returns the list of all registered managers.")
		.create()
		.<Rest.Type>cast()
		.process(() ->
		{
			Data list = Data.map();
			for( Manager.Type p : Manager.all() )
				list.put(StringUtils.toLowerCase(p.manager()), p.export());
			return list;
		})
		.url(ROOT + "managers")
		.method("GET")
		;
	
	private static final Endpoint.Rest.Type system = new Endpoint.Rest() { }
		.template()
		.summary("Lists system metrics")
		.description("This endpoint returns various system and hardware metrics.")
		.create()
		.<Rest.Type>cast()
		.process(() ->
		{
			return Hardware.export().put("system", Data.map()
				.put("version", Boot.VERSION)
				.put("boot", Boot.BOOT_TIME)
				.put("jvm", Runtime.version())
				.put("time", System.currentTimeMillis())
				);
		})
		.url(ROOT + "system")
		.method("GET")
		;
		
	private static final Endpoint.Rest.Type probes = new Endpoint.Rest() { }
		.template()
		.summary("Fetch system probes")
		.description("This endpoint returns the information provided by registered probes on the system. If a probe name is provided, only that one is returned.")
		.add(new Parameter("name").optional(true)
			.summary("Probe name")
			.description("If defined, this parameter specifies which probe to include in the response. If not defined, then all probes are returned.")
			.format(Parameter.Format.TEXT)
			)
		.create()
		.<Rest.Type>cast()
		.process((parameters) ->
		{
			if( !parameters.isEmpty("name") )
			{
				Probe.Type probe = Registry.of(Probe.class).get(parameters.asString("name"));
				return probe == null ? Data.map() : Data.map().put(parameters.asString("name"), probe.report());
			}
			else
			{
				Data probes = Data.map();
				for( Probe.Type p : Registry.of(Probe.class) )
					probes.put(p.name(), p.report());
				return probes;
			}
		})
		.url(ROOT + "probe")
		.method("GET")
		;
		
	private static final Endpoint.Rest.Type overview = new Endpoint.Rest() { }
		.template()
		.summary("Full system overview")
		.description("Returns a full system overview including the plugins, managers, registry and factory.")
		.create()
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
				
				return Data.map()
					.put("plugins", plugins.process())
					.put("managers", managers.process())
					.put("registry", registry)
					.put("factory", factory)
					;
			}
			catch(Exception e) { throw new RuntimeException(e); }
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
			.format(Parameter.Format.TEXT)
			)
		.add(new Parameter("id").optional(false)
			.summary("The entity id")
			.description("The entity id.")
			.format(Parameter.Format.TEXT)
			)
		.create()
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
			.format(Parameter.Format.TEXT)
			)
		.add(new Parameter("id").optional(false)
			.summary("The entity id")
			.description("The entity id.")
			.format(Parameter.Format.TEXT)
			)
		.create()
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
			.format(Parameter.Format.TEXT)
			)
		.add(new Parameter("type").optional(false).min(1).max(100)
			.summary("The entity type")
			.description("The entity type.")
			.format(Parameter.Format.TEXT)
			)
		.add(new Parameter("data").optional(false)
			.summary("The entity data")
			.description("The entity data. It should always be a json object.")
			.rule(Parameter.Rule.JSON_MAP)
			.format(Parameter.Format.JSON)
			)
		.create()
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
			
			Entity e = t.create(parameters.get("data"));
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
			.format(Parameter.Format.TEXT)
			)
		.add(new Parameter("id").optional(false)
			.summary("The entity id")
			.description("The entity id.")
			.format(Parameter.Format.TEXT)
			)
		.add(new Parameter("data").optional(false)
			.summary("The entity data")
			.description("The entity data. It should always be a json object.")
			.rule(Parameter.Rule.JSON_MAP)
			.format(Parameter.Format.JSON)
			)
		.create()
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
			
			Factory.of(e).update(parameters.get("data"), e);
			return null; 
		})
		.url(ROOT + "entity/{category}/{id}")
		.method("PUT");
		
	private static final Endpoint.Rest.Type entity_ghost = new Endpoint.Rest() { }
		.template()
		.summary("Find ghost entities")
		.description("A ghost entity is an entity that is loosely referenced but that does not exist in the registry. This endpoint lists all entities that reference ghosts.")
		.create()
		.<Rest.Type>cast()
		.process((parameters) ->
		{
			Data ghosts = Data.list();
			for( Registry<?> r : Registry.all() )
			{
				for( Entity e : r )
				{
					for( String relation : e.relationships() )
					{
						for( Tuple<Entity, Data> t : e.relations(relation) )
						{
							if( t.a == null )
							{
								ghosts.add(Data.map()
									.put("category", e.category())
									.put("id", e.id())
									.put("name", e.name())
									.put("relationship", relation)
									.put("ghost", t.b)
									);
							}
						}
					}
				}
			}
			
			return ghosts;
		})
		.url(ROOT + "entity/ghosts")
		.method("GET")
		;
	
	public static final Endpoint.Rest.Type usage = new Endpoint.Rest() { }
		.template()
		.summary("Fetch usage data")
		.description("This endpoint returns thread usage data since last call. The time is measured in ns.")
		.add(new Parameter("granularity")
			.summary("Monitoring data granularity")
			.description("Monitoring data is aggregated every 10 seconds on a hourly basis, every hour on a daily basis and every day on a yearly basis."
					+ " When requesting hourly or daily data, only the current hour or day is returned. When requesting the yearly aggregate, you may choose the"
					+ " desired year using the 'year' parameter.")
			.optional(false)
			.values("hour", "day", "year")
			.format(Parameter.Format.TEXT))
		.add(new Parameter("year")
			.summary("Year")
			.description("Specify which aggregated year data should be returned. If not specified, the current year is returned.")
			.optional(true)
			.format(Parameter.Format.NUMBER)
			)
		.create()
		.<Rest.Type>cast()
		.process((parameters) ->
		{
			Storage.Type s = Registry.of(Storage.class).get(Manager.of(Config.class).get(Monitor.class, "storage").asString());
			
			String data = null;
			if( parameters.asString("granularity").equals("hour") )
				data = s.getString(".hour");
			else if( parameters.asString("granularity").equals("day") )
				data = s.getString(".day");
			else if( parameters.asString("granularity").equals("year") )
			{
				if( parameters.containsKey("year") )
					data = s.getString(parameters.asInt("year") + ".json");
				else
					data = s.getString(ZonedDateTime.now().getYear() + ".json");
			}
			
			return Data.map()
				.put("isHttpResponse", true)
				.put("code", 200)
				.put("body", data == null ? "{}" : data)
				.put("mime", "application/json");
		})
		.url(ROOT + "usage")
		.method("GET");
	
	public static final Endpoint.Rest.Type monitoring = new Endpoint.Rest() { }
		.template()
		.summary("Fetch monitoring data")
		.description("This endpoint returns all available monitoring data for the last completed time frame.")
		.create()
		.<Rest.Type>cast()
		.process((parameters) ->
		{
			return Manager.of(Monitor.class).report();
		})
		.url(ROOT + "monitoring")
		.method("GET");
		
	public static final Endpoint.Rest.Type integrity = new Endpoint.Rest() { }
		.template()
		.summary("Provides system integrity information")
		.description("This endpoint returns information about all plugins in the system.")
		.create()
		.<Rest.Type>cast()
		.process((parameters) ->
		{
			Data list = Data.map();
			
			List<Module> modules = new ArrayList<>(aeonics.Plugin.getModuleLayer().modules());
			modules.add(aeonics.Boot.class.getModule());
			
			modules.forEach((m) -> {
				Data p = Data.map();
				list.put(m.getName(), p);
				
				p.put("packages", m.getPackages());
				p.put("uses", m.getDescriptor().uses());
				p.put("provides", m.getDescriptor().provides().stream().map(Provides::toString).collect(Collectors.toList()));
				p.put("opens", m.getDescriptor().opens().stream().map(Opens::toString).collect(Collectors.toList()));
				p.put("exports", m.getDescriptor().exports().stream().map(Exports::toString).collect(Collectors.toList()));
				p.put("requires", m.getDescriptor().requires().stream().map(Requires::toString).collect(Collectors.toList()));
				
				ResolvedModule r = m.getLayer().configuration().findModule(m.getName()).orElse(null);
				URI location = r == null ? null : r.reference().location().orElse(null);
				if( r == null )
				{
					p.put("file", null).put("hash", null).put("modified", null).put("size", null);
				}
				else
				{
					Path file = Paths.get(location);
					p.put("file", file.getFileName().toString());
					try { p.put("modified", Files.getLastModifiedTime(file).toMillis()); }
					catch(Exception e) { p.put("modified", null); }
					try( InputStream is = Files.newInputStream(file) ) { p.put("hash", Manager.of(aeonics.manager.Security.class).hash(is)); }
					catch(Exception e) { p.put("hash", null); }
					try { p.put("size", Files.size(file)); }
					catch(Exception e) { p.put("size", null); }
				}
			});
			
			Data details = plugins.process();
			for( Data p : details )
				if( list.containsKey(p.asString("name")) )
					list.get(p.asString("name")).put("summary", p.get("summary")).put("description", p.get("description"));
			
			return list;
		})
		.url(ROOT + "integrity")
		.method("GET");
}
