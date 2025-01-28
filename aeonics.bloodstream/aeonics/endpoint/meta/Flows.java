package aeonics.endpoint.meta;

import aeonics.data.Data;
import aeonics.entity.Entity;
import aeonics.entity.Flow;
import aeonics.entity.Step;
import aeonics.entity.Registry;
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
			
			Registry.of(Step.class).forEach(e ->
			{
				found.a = false;
				Registry.of(Flow.class).forEach(flow ->
				{
					if( found.a ) return;
					for( Tuple<Entity, Data> t : flow.relations("steps") )
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
						.put("icon", e.template().<Step.Template>cast().icon())
						.put("x", 0)
						.put("y", 0)
					);
					
					for( Tuple<Entity, Data> o : e.relations("links") )
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
			
			for( Tuple<Entity, Data> t : flow.relations("steps") )
			{
				if( t.a == null ) continue;
				entities.add(Data.map()
					.put("id", t.a.id())
					.put("category", t.a.category())
					.put("name", t.a.name())
					.put("icon", t.a.template().<Step.Template>cast().icon())
					.put("summary", t.a.template().summary())
					.put("description", t.a.template().description())
					.put("x", t.b.get("x"))
					.put("y", t.b.get("y"))
					.put("inputs", t.a.template().<Step.Template>cast().inputs())
					.put("outputs", t.a.template().<Step.Template>cast().outputs())
				);
				
				for( Tuple<Entity, Data> o : t.a.relations("links") )
				{
					if( o.a == null ) continue;
					links.add(Data.map()
						.put("from", Data.map().put("id", t.a.id()).put("name", t.a.name()).put("output", t.b.get("output")))
						.put("to", Data.map().put("id", o.a.id()).put("name", o.a.name()).put("input", t.b.get("input")))
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
		
	private static final Endpoint.Rest.Type link_delete = new Endpoint.Rest() { }
		.template()
		.summary("Remove a flow link")
		.description("This endpoint can be used to remove an existing link between flow steps.")
		.add(new Parameter("from").optional(false)
			.summary("Origin step id")
			.description("The origin flow step id.")
			.format(Parameter.Format.TEXT)
			)
		.add(new Parameter("output").optional(false)
			.summary("Output channel name")
			.description("The origin flow step output channel name.")
			.format(Parameter.Format.TEXT)
			)
		.add(new Parameter("to").optional(false)
			.summary("Destination step id")
			.description("The destination flow step id.")
			.format(Parameter.Format.TEXT)
			)
		.add(new Parameter("input").optional(false)
			.summary("Destination channel name")
			.description("The destination flow step input channel name.")
			.format(Parameter.Format.TEXT)
			)
		.create()
		.<Rest.Type>cast()
		.process((parameters) ->
		{
			Step.Type step = Registry.of(Step.class).get(parameters.asString("from"));
			if( step == null )
				return null;
			
			step.unlink(
				parameters.asString("output"), 
				Registry.of(Step.class).get(parameters.asString("to")), 
				parameters.asString("input"));
			
			return null;
		})
		.url(ROOT + "flow/link")
		.method("DELETE")
		;
		
	private static final Endpoint.Rest.Type link_add = new Endpoint.Rest() { }
		.template()
		.summary("Add a flow link")
		.description("This endpoint can be used to create a link between flow steps. If the link already exists, it is overwritten.")
		.add(new Parameter("from").optional(false)
			.summary("Origin step id")
			.description("The origin flow step id.")
			.format(Parameter.Format.TEXT)
			)
		.add(new Parameter("output").optional(false)
			.summary("Output channel name")
			.description("The origin flow step output channel name.")
			.format(Parameter.Format.TEXT)
			)
		.add(new Parameter("to").optional(false)
			.summary("Destination step id")
			.description("The destination flow step id.")
			.format(Parameter.Format.TEXT)
			)
		.add(new Parameter("input").optional(false)
			.summary("Destination channel name")
			.description("The destination flow step input channel name.")
			.format(Parameter.Format.TEXT)
			)
		.add(new Parameter("parameters").optional(true)
			.summary("Additional parameters")
			.description("Optional additional link parameters.")
			.format(Parameter.Format.JSON)
			.rule(Parameter.Rule.JSON_MAP)
			)
		.create()
		.<Rest.Type>cast()
		.process((parameters) ->
		{
			Step.Type from = Registry.of(Step.class).get(parameters.asString("from"));
			Step.Type to = Registry.of(Step.class).get(parameters.asString("to"));
			if( from == null || to == null )
				throw new HttpException(404);
			
			from.unlink(
				parameters.asString("output"), 
				to, 
				parameters.asString("input"));
			
			from.link(
				parameters.asString("output"), 
				to, 
				parameters.asString("input"),
				parameters.get("parameters"));
			
			return null;
		})
		.url(ROOT + "flow/link")
		.method("POST")
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
					flow.clearRelation("steps");
					
					for( Data e : data.get("entities") )
					{
						Step.Type target = null;
						if( (target = Registry.of(Step.class).get(e.asString("id"))) != null )
							flow.step(target, e.asInt("x"), e.asInt("y"));
					}
				}
			}
			return null;
		})
		.url(ROOT + "flow/{id}")
		.method("PUT")
		;

}
