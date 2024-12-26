package aeonics.endpoint.meta;

import aeonics.data.Data;
import aeonics.entity.Action;
import aeonics.entity.Destination;
import aeonics.entity.Entity;
import aeonics.entity.Flow;
import aeonics.entity.Origin;
import aeonics.entity.Queue;
import aeonics.entity.Registry;
import aeonics.entity.Topic;
import aeonics.http.Endpoint;
import aeonics.http.HttpException;
import aeonics.http.Endpoint.Rest;
import aeonics.template.Parameter;
import aeonics.util.Json;
import aeonics.util.Tuples;
import aeonics.util.Tuples.Single;
import aeonics.util.Tuples.Tuple;

@SuppressWarnings("unused")
public class Flows 
{
	private Flows() { /* no instances */ }
	
	private static final String ROOT = "/api/meta/";
	private static final String ORPHAN_FLOW_ID = "10000000-ffffffffffffffff";
	
	public static void register()
	{
		// calling this method will force initialization of all private static members
		// all endpoints will be added to the registry automatically
	}
	
	private static final Endpoint.Rest.Type orphan = new Endpoint.Rest() { }
		.template()
		.summary("Orphan entities")
		.description("This endpoint returns a virutal flow containing all orphan entities that are not referenced in any flow. "
				+ "The ID of the virtual flow is \"" + ORPHAN_FLOW_ID + "\".")
		.create()
		.<Rest.Type>cast()
		.process((parameters) ->
		{
			Data data = Data.map()
				.put("id", ORPHAN_FLOW_ID)
				.put("name", "")
				.put("notes", "")
				.put("size", 0);
			
			Data links = Data.list();
			Data entities = Data.list();
			Single<Boolean> found = Single.of(false);
			
			Registry.of(Origin.class).forEach(e ->
			{
				found.a = false;
				Registry.of(Flow.class).forEach(flow ->
				{
					if( found.a ) return;
					for( Tuple<Entity, Data> t : flow.relations("origins") )
					{
						if( t.a == null ) continue;
						if( t.a == e ) found.a = true;
					}
				});
				
				if( !found.a )
				{
					entities.add(Data.map()
						.put("id", e.id())
						.put("category", e.category())
						.put("name", e.name())
						.put("icon", e.template().icon())
						.put("x", 0)
						.put("y", 0)
					);
					
					for( Tuple<Entity, Data> o : e.relations("topics") )
					{
						links.add(Data.map()
							.put("from", Data.map().put("id", e.id()).put("name", e.name()))
							.put("to", Data.map().put("id", o.a.id()).put("name", o.a.name()))
						);
					}
				}
			});
			
			Registry.of(Action.class).forEach(e ->
			{
				found.a = false;
				Registry.of(Flow.class).forEach(flow ->
				{
					if( found.a ) return;
					for( Tuple<Entity, Data> t : flow.relations("actions") )
					{
						if( t.a == null ) continue;
						if( t.a == e ) found.a = true;
						
					}
				});
				
				if( !found.a )
				{
					entities.add(Data.map()
						.put("id", e.id())
						.put("category", e.category())
						.put("name", e.name())
						.put("icon", e.template().icon())
						.put("x", 0)
						.put("y", 0)
					);
					
					for( Tuple<Entity, Data> o : e.relations("actions") )
					{
						links.add(Data.map()
							.put("from", Data.map().put("id", e.id()).put("name", e.name()))
							.put("to", Data.map().put("id", o.a.id()).put("name", o.a.name()))
						);
					}
					
					for( Tuple<Entity, Data> o : e.relations("destinations") )
					{
						links.add(Data.map()
							.put("from", Data.map().put("id", e.id()).put("name", e.name()))
							.put("to", Data.map().put("id", o.a.id()).put("name", o.a.name()))
						);
					}
				}
			});
			
			Registry.of(Destination.class).forEach(e ->
			{
				found.a = false;
				Registry.of(Flow.class).forEach(flow ->
				{
					if( found.a ) return;
					for( Tuple<Entity, Data> t : flow.relations("destinations") )
					{
						if( t.a == null ) continue;
						if( t.a == e ) found.a = true;
					}
				});
				
				if( !found.a )
				{
					entities.add(Data.map()
						.put("id", e.id())
						.put("category", e.category())
						.put("name", e.name())
						.put("icon", e.template().icon())
						.put("x", 0)
						.put("y", 0)
					);
				}
			});
			
			Registry.of(Queue.class).forEach(e ->
			{
				found.a = false;
				Registry.of(Flow.class).forEach(flow ->
				{
					if( found.a ) return;
					for( Tuple<Entity, Data> t : flow.relations("queues") )
					{
						if( t.a == null ) continue;
						if( t.a == e ) found.a = true;
					}
				});
				
				if( !found.a )
				{
					entities.add(Data.map()
						.put("id", e.id())
						.put("category", e.category())
						.put("name", e.name())
						.put("icon", e.template().icon())
						.put("x", 0)
						.put("y", 0)
					);
					
					for( Tuple<Entity, Data> o : e.relations("actions") )
					{
						links.add(Data.map()
							.put("from", Data.map().put("id", e.id()).put("name", e.name()))
							.put("to", Data.map().put("id", o.a.id()).put("name", o.a.name()))
						);
					}
					
					for( Tuple<Entity, Data> o : e.relations("destinations") )
					{
						links.add(Data.map()
							.put("from", Data.map().put("id", e.id()).put("name", e.name()))
							.put("to", Data.map().put("id", o.a.id()).put("name", o.a.name()))
						);
					}
				}
			});
			
			Registry.of(Topic.class).forEach(e ->
			{
				found.a = false;
				Registry.of(Flow.class).forEach(flow ->
				{
					if( found.a ) return;
					for( Tuple<Entity, Data> t : flow.relations("topics") )
					{
						if( t.a == null ) continue;
						if( t.a == e ) found.a = true;
					}
				});
				
				if( !found.a )
				{
					entities.add(Data.map()
						.put("id", e.id())
						.put("category", e.category())
						.put("name", e.name())
						.put("icon", e.template().icon())
						.put("x", 0)
						.put("y", 0)
					);
					
					for( Tuple<Entity, Data> o : e.relations("queues") )
					{
						links.add(Data.map()
							.put("from", Data.map().put("id", e.id()).put("name", e.name()))
							.put("to", Data.map().put("id", o.a.id()).put("name", o.a.name()))
						);
					}
				}
			});
			
			data
				.put("links", links)
				.put("entities", entities);
			
			return data;
		})
		.url(ROOT + "flow/orphan")
		.method("GET")
		;
	
	private static final Endpoint.Rest.Type flow = new Endpoint.Rest() { }
		.template()
		.summary("Fetch a flow")
		.description("This endpoint returns all necessary information to visualize a data flow.")
		.add(new Parameter("id").optional(false)
			.summary("The flow id")
			.description("The flow id.")
			.format(Parameter.Format.TEXT)
			)
		.create()
		.<Rest.Type>cast()
		.process((parameters) ->
		{
			if( parameters.asString("id").equals(ORPHAN_FLOW_ID) )
				return orphan.process(parameters);
			
			Flow.Type flow = Registry.of(Flow.class).get(parameters.asString("id"));
			if( flow == null )
				throw new HttpException(404);
			
			Data data = Data.map()
				.put("id", flow.id())
				.put("name", flow.name())
				.put("notes", flow.valueOf("notes"))
				.put("size", flow.valueOf("size"));
			
			Data links = Data.list();
			Data entities = Data.list();
			
			for( Tuple<Entity, Data> t : flow.relations("origins") )
			{
				if( t.a == null ) continue;
				entities.add(Data.map()
					.put("id", t.a.id())
					.put("category", t.a.category())
					.put("name", t.a.name())
					.put("icon", t.a.template().icon())
					.put("x", t.b.get("x"))
					.put("y", t.b.get("y"))
				);
				
				for( Tuple<Entity, Data> o : t.a.relations("topics") )
				{
					links.add(Data.map()
						.put("from", Data.map().put("id", t.a.id()).put("name", t.a.name()))
						.put("to", Data.map().put("id", o.a.id()).put("name", o.a.name()))
					);
				}
			}
			
			for( Tuple<Entity, Data> t : flow.relations("actions") )
			{
				if( t.a == null ) continue;
				entities.add(Data.map()
					.put("id", t.a.id())
					.put("category", t.a.category())
					.put("name", t.a.name())
					.put("icon", t.a.template().icon())
					.put("x", t.b.get("x"))
					.put("y", t.b.get("y"))
				);
				
				for( Tuple<Entity, Data> o : t.a.relations("actions") )
				{
					links.add(Data.map()
						.put("from", Data.map().put("id", t.a.id()).put("name", t.a.name()))
						.put("to", Data.map().put("id", o.a.id()).put("name", o.a.name()))
					);
				}
				
				for( Tuple<Entity, Data> o : t.a.relations("destinations") )
				{
					links.add(Data.map()
						.put("from", Data.map().put("id", t.a.id()).put("name", t.a.name()))
						.put("to", Data.map().put("id", o.a.id()).put("name", o.a.name()))
					);
				}
			}
			
			for( Tuple<Entity, Data> t : flow.relations("destinations") )
			{
				if( t.a == null ) continue;
				entities.add(Data.map()
					.put("id", t.a.id())
					.put("category", t.a.category())
					.put("name", t.a.name())
					.put("icon", t.a.template().icon())
					.put("x", t.b.get("x"))
					.put("y", t.b.get("y"))
				);
			}
			
			for( Tuple<Entity, Data> t : flow.relations("queues") )
			{
				if( t.a == null ) continue;
				entities.add(Data.map()
					.put("id", t.a.id())
					.put("category", t.a.category())
					.put("name", t.a.name())
					.put("icon", t.a.template().icon())
					.put("x", t.b.get("x"))
					.put("y", t.b.get("y"))
				);
				
				for( Tuple<Entity, Data> o : t.a.relations("actions") )
				{
					links.add(Data.map()
						.put("from", Data.map().put("id", t.a.id()).put("name", t.a.name()))
						.put("to", Data.map().put("id", o.a.id()).put("name", o.a.name()))
					);
				}
				
				for( Tuple<Entity, Data> o : t.a.relations("destinations") )
				{
					links.add(Data.map()
						.put("from", Data.map().put("id", t.a.id()).put("name", t.a.name()))
						.put("to", Data.map().put("id", o.a.id()).put("name", o.a.name()))
					);
				}
			}
			
			for( Tuple<Entity, Data> t : flow.relations("topics") )
			{
				if( t.a == null ) continue;
				entities.add(Data.map()
					.put("id", t.a.id())
					.put("category", t.a.category())
					.put("name", t.a.name())
					.put("icon", t.a.template().icon())
					.put("x", t.b.get("x"))
					.put("y", t.b.get("y"))
				);
				
				for( Tuple<Entity, Data> o : t.a.relations("queues") )
				{
					links.add(Data.map()
						.put("from", Data.map().put("id", t.a.id()).put("name", t.a.name()))
						.put("to", Data.map().put("id", o.a.id()).put("name", o.a.name()))
					);
				}
			}
			
			data
				.put("links", links)
				.put("entities", entities);
			
			return data;
		})
		.url(ROOT + "flow/{id}")
		.method("GET")
		;
	
	private static final Endpoint.Rest.Type flow_save = new Endpoint.Rest() { }
		.template()
		.summary("Save flow")
		.description("This endpoint can be used to save the position of all entities within a flow.")
		.add(new Parameter("id").optional(false)
			.summary("The flow id")
			.description("The flow id.")
			.format(Parameter.Format.TEXT)
			)
		.add(new Parameter("data").optional(false)
			.summary("The flow data. It must contain the 'size' of the flow as well as the 'entities' with 'x', 'y' position.")
			.description("The flow size and elements.")
			.format(Parameter.Format.JSON)
			.rule(Parameter.Rule.JSON_MAP)
			)
		.create()
		.<Rest.Type>cast()
		.process((parameters) ->
		{
			if( parameters.asString("id").equals(ORPHAN_FLOW_ID) )
				return null;
			
			Flow.Type flow = Registry.of(Flow.class).get(parameters.asString("id"));
			synchronized(flow)
			{
				if( flow == null )
					throw new HttpException(404);
				
				if( !parameters.isMap("data") )
					parameters.put("data", Json.decode(parameters.asString("data")));
				if( !parameters.isMap("data") )
					throw new HttpException(413, "Input data must be a json object");
				
				Data data = parameters.get("data");
				if( data.containsKey("size") )
					flow.parameter("size", data.asInt("size"));
				
				if( data.isList("entities") )
				{
					flow.clearRelation("origins");
					flow.clearRelation("topics");
					flow.clearRelation("actions");
					flow.clearRelation("queues");
					flow.clearRelation("destinations");
					
					for( Data e : data.get("entities") )
					{
						Entity target = null;
						if( (target = Registry.of(Origin.class).get(e.asString("id"))) != null )
							flow.addRelation("origins", target, Data.map().put("x", e.asInt("x")).put("y", e.asInt("y")));
						else if( (target = Registry.of(Topic.class).get(e.asString("id"))) != null )
							flow.addRelation("topics", target, Data.map().put("x", e.asInt("x")).put("y", e.asInt("y")));
						else if( (target = Registry.of(Queue.class).get(e.asString("id"))) != null )
							flow.addRelation("queues", target, Data.map().put("x", e.asInt("x")).put("y", e.asInt("y")));
						else if( (target = Registry.of(Action.class).get(e.asString("id"))) != null )
							flow.addRelation("actions", target, Data.map().put("x", e.asInt("x")).put("y", e.asInt("y")));
						else if( (target = Registry.of(Destination.class).get(e.asString("id"))) != null )
							flow.addRelation("destinations", target, Data.map().put("x", e.asInt("x")).put("y", e.asInt("y")));
					}
				}
			}
			return null;
		})
		.url(ROOT + "flow/{id}")
		.method("PUT")
		;

}
