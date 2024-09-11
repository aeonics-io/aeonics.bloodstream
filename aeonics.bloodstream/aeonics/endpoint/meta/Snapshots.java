package aeonics.endpoint.meta;

import java.nio.charset.StandardCharsets;

import aeonics.data.Data;
import aeonics.http.Endpoint;
import aeonics.http.HttpException;
import aeonics.http.Endpoint.Rest;
import aeonics.manager.Manager;
import aeonics.manager.Snapshot;
import aeonics.template.Parameter;

@SuppressWarnings("unused")
public class Snapshots
{
	private Snapshots() { /* no instances */ }
	
	public static void register()
	{
		// calling this method will force initialization of all private static members
		// all endpoints will be added to the registry automatically
	}
	
	private static final Endpoint.Rest.Type snapshot = new Endpoint.Rest() { }
		.template()
		.summary("Create a system snapshot")
		.description("This endpoint triggers the creation of a system snapshot.")
		.add(new Parameter("name")
			.summary("Name")
			.description("The snapshot name suffix. It may not contain any special characters. The final snapshot name is returned.")
			.format(Parameter.Format.TEXT)
			.rule(Parameter.Rule.ALPHANUM)
			.max(30)
			.optional(true)
			.defaultValue(""))
		.create()
		.<Rest.Type>cast()
		.process((params, user) ->
		{
			return Data.map()
				.put("name", Manager.of(Snapshot.class).create(params.asString("name")).await())
				.put("success", true);
		})
		.url("/api/admin/snapshot/create")
		.method("GET")
		;
	
	private static final Endpoint.Rest.Type latest = new Endpoint.Rest() { }
		.template()
		.summary("Latest snapshot")
		.description("This endpoint returns the name of the latest snapshot.")
		.create()
		.<Rest.Type>cast()
		.process((params, user) ->
		{
			return Data.map()
				.put("name", Manager.of(Snapshot.class).latest());
		})
		.url("/api/admin/snapshot/latest")
		.method("GET")
		;
		
	private static final Endpoint.Rest.Type all = new Endpoint.Rest() { }
		.template()
		.summary("List snapshots")
		.description("This endpoint returns the list of all snapshots.")
		.create()
		.<Rest.Type>cast()
		.process((params, user) ->
		{
			return Data.of(Manager.of(Snapshot.class).list());
		})
		.url("/api/admin/snapshot/list")
		.method("GET")
		;
		
	private static final Endpoint.Rest.Type restore = new Endpoint.Rest() { }
		.template()
		.summary("Restore a snapshot")
		.description("This endpoint triggers the system snapshot restoration. This endpoint returns when the operation is complete.")
		.add(new Parameter("name")
			.summary("Name")
			.description("The snapshot name.")
			.format(Parameter.Format.TEXT)
			.optional(false))
		.create()
		.<Rest.Type>cast()
		.process((params, user) ->
		{
			Manager.of(Snapshot.class).restore(params.asString("name")).await();
			return Data.map().put("success", true);
		})
		.url("/api/admin/snapshot/restore/{name}")
		.method("GET")
		;
	
	private static final Endpoint.Rest.Type remove = new Endpoint.Rest() { }
		.template()
		.summary("Remove a snapshot")
		.description("This endpoint permanently deletes a snapshot.")
		.add(new Parameter("name")
			.summary("Name")
			.description("The snapshot name.")
			.format(Parameter.Format.TEXT)
			.optional(false))
		.create()
		.<Rest.Type>cast()
		.process((params, user) ->
		{
			Manager.of(Snapshot.class).remove(params.asString("name"));
			return Data.map().put("success", true);
		})
		.url("/api/admin/snapshot/{name}")
		.method("DELETE")
		;
	
	private static final Endpoint.Rest.Type upload = new Endpoint.Rest() { }
		.template()
		.summary("Uploads a snapshot")
		.description("This endpoint uploads a snapshot on this system.")
		.add(new Parameter("zip")
			.summary("Zip file")
			.description("The snapshot content as a zip file.")
			.format(Parameter.Format.OPAQUE)
			.optional(false))
		.create()
		.<Rest.Type>cast()
		.process((params, user, request) ->
		{
			byte[] zip = null;
			if( params.isMap("zip") ) zip = params.get("zip").asString("content").getBytes(StandardCharsets.ISO_8859_1);
			else zip = params.asString("zip").getBytes(StandardCharsets.ISO_8859_1);

			try { Manager.of(Snapshot.class).upload(zip); }
			catch(Exception e) { throw new HttpException(413, e); }
			return Data.map().put("success", true);
		})
		.url("/api/admin/snapshot/upload")
		.method("POST")
		;
	
	private static final Endpoint.Rest.Type download = new Endpoint.Rest() { }
		.template()
		.summary("Download a snapshot")
		.description("This endpoint downloads the specified snapshot as a zip file.")
		.add(new Parameter("name")
			.summary("Name")
			.description("The snapshot name.")
			.format(Parameter.Format.TEXT)
			.optional(false))
		.create()
		.<Rest.Type>cast()
		.process((params, user) ->
		{
			byte[] snapshot = Manager.of(Snapshot.class).download(params.asString("name"));
			return Data.map()
				.put("isHttpResponse", true)
				.put("code", 200)
				.put("body", new String(snapshot, StandardCharsets.ISO_8859_1))
				.put("mime", "application/zip");
		})
		.url("/api/admin/snapshot/download/{name}")
		.method("GET")
		;
}
