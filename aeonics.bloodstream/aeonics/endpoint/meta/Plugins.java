package aeonics.endpoint.meta;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;

import aeonics.Boot;
import aeonics.data.Data;
import aeonics.entity.Entity;
import aeonics.entity.Registry;
import aeonics.http.Endpoint;
import aeonics.http.HttpException;
import aeonics.http.Endpoint.Rest;
import aeonics.manager.Config;
import aeonics.manager.Manager;
import aeonics.manager.Scheduler;
import aeonics.manager.Snapshot;
import aeonics.template.Parameter;

@SuppressWarnings("unused")
public class Plugins
{
	private Plugins() { /* no instances */ }
	
	private static final String ROOT = "/api/meta/";
	
	public static void register()
	{
		// calling this method will force initialization of all private static members
		// all endpoints will be added to the registry automatically
	}
	
	private static final Endpoint.Rest.Type plugin_deploy = new Endpoint.Rest() { }
		.template()
		.summary("Deploy a plugin")
		.description("This endpoint can be used to upload a plugin on the system. Note that a reboot is required afterwards.")
		.add(new Parameter("file").optional(false)
			.summary("The plugin file")
			.description("The plugin file.")
			.format(Parameter.Format.OPAQUE)
			)
		.create()
		.<Rest.Type>cast()
		.process((params, user, request) ->
		{
			if( !params.isMap("file") || params.get("file").isEmpty("name") || params.get("file").isEmpty("content") )
				throw new HttpException(413, "Invalid plugin file");
			
			try
			{
				String path = Manager.of(Config.class).get(aeonics.Plugin.class, "path").asString();
				Path p = Path.of(path);
				if( !Files.isDirectory(p) ) throw new Exception("Destination directory does not exist");
				
				byte[] jar = params.get("file").asString("content").getBytes(StandardCharsets.ISO_8859_1);
				Path f = Path.of(params.get("file").asString("name")).normalize().getFileName();
				
				Files.write(p.resolve(f), jar);
			}
			catch(Exception e) { throw new HttpException(413, e); }
			return Data.map().put("success", true);
		})
		.url(ROOT + "plugin")
		.method("POST")
		;
	
	private static final Endpoint.Rest.Type plugin_undeploy = new Endpoint.Rest() { }
		.template()
		.summary("Undeploy a plugin")
		.description("This endpoint can be used to remove a plugin from the system. Note that a reboot is required afterwards.")
		.add(new Parameter("file").optional(false)
			.summary("File name")
			.description("The plugin file name.")
			.format(Parameter.Format.TEXT)
			)
		.create()
		.<Rest.Type>cast()
		.process((params, user, request) ->
		{
			try
			{
				String path = Manager.of(Config.class).get(aeonics.Plugin.class, "path").asString();
				Path p = Path.of(path);
				if( !Files.isDirectory(p) ) throw new Exception("Destination directory does not exist");
				Path f = Path.of(params.asString("file")).normalize().getFileName();
				p = p.resolve(f);
				if( !Files.isRegularFile(p) ) throw new Exception("Target plugin does not exist");
				Files.delete(p);
			}
			catch(Exception e) { throw new HttpException(413, e); }
			return Data.map().put("success", true);
		})
		.url(ROOT + "plugin/{file}")
		.method("DELETE")
		;
	
	private static final Endpoint.Rest.Type system_shutdown = new Endpoint.Rest() { }
		.template()
		.summary("Shutdown")
		.description("Triggers a system shutdown. If the system is setup as a service, it shall be rebooted automatically. Upon restart, "
				+ "the latest snapshot will be loaded as instructed by the regular startup sequence.")
		.create()
		.<Rest.Type>cast()
		.process((params, user, request) ->
		{
			Manager.of(Scheduler.class).in((time) -> { Boot.MAIN.interrupt(); }, 100);
			return Data.map().put("success", true);
		})
		.url(ROOT + "system/shutdown")
		.method("POST")
		;
}
