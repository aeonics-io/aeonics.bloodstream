package aeonics.endpoint.meta;

import java.nio.charset.StandardCharsets;
import java.nio.file.Path;

import aeonics.data.Data;
import aeonics.entity.Database;
import aeonics.entity.Registry;
import aeonics.http.Endpoint;
import aeonics.http.Endpoint.Rest;
import aeonics.http.HttpException;
import aeonics.http.Mime;
import aeonics.template.Parameter;

@SuppressWarnings("unused")
public class Storage
{
	private Storage() { /* no instances */ }
	
	public static void register()
	{
		// calling this method will force initialization of all private static members
		// all endpoints will be added to the registry automatically
	}
	
	private static final Endpoint.Rest.Type query = new Endpoint.Rest() { }
		.template()
		.returns("The database response")
		.summary("Query database")
		.description("This endpoint passes an arbitrary query to the database.")
		.add(new Parameter("id")
			.summary("Database")
			.description("The id of the database.")
			.format(Parameter.Format.TEXT)
			.rule(Parameter.Rule.ID)
			.optional(false))
		.add(new Parameter("sql")
			.summary("Query")
			.description("The SQL query to perform.")
			.format(Parameter.Format.TEXT)
			.optional(false))
		.create()
		.<Rest.Type>cast()
		.process((params, user) ->
		{
			Database.Type db = Registry.of(Database.class).get(params.asString("id"));
			if( db == null ) throw new HttpException(413, "Unknown database");
			
			return db.query(params.asString("sql"));
		})
		.url("/api/admin/database/{id}/query")
		.method("GET")
		;
	
	private static final Endpoint.Rest.Type list = new Endpoint.Rest() { }
		.template()
		.returns("An array of file names in the specified path. Folder names end with '/'.")
		.summary("List storage")
		.description("List the content of a storage.")
		.add(new Parameter("id")
			.summary("Storage")
			.description("The id of the storage.")
			.format(Parameter.Format.TEXT)
			.rule(Parameter.Rule.ID)
			.optional(false))
		.add(new Parameter("path")
			.summary("Path")
			.description("The directory to list.")
			.format(Parameter.Format.TEXT)
			.optional(true)
			.defaultValue("/"))
		.create()
		.<Rest.Type>cast()
		.process((params, user) ->
		{
			aeonics.entity.Storage.Type s = Registry.of(aeonics.entity.Storage.class).get(params.asString("id"));
			if( s == null ) throw new HttpException(413, "Unknown storage");
			
			return Data.of(s.tree(params.asString("path")));
		})
		.url("/api/admin/storage/{id}")
		.method("GET")
		;
	
	private static final Endpoint.Rest.Type upload = new Endpoint.Rest() { }
		.template()
		.returns("Nothing (code 204)")
		.summary("Upload file")
		.description("Uploads a file in the storage.")
		.add(new Parameter("id")
			.summary("Storage")
			.description("The id of the storage.")
			.format(Parameter.Format.TEXT)
			.rule(Parameter.Rule.ID)
			.optional(false))
		.add(new Parameter("path")
			.summary("Path")
			.description("The target directory or file name.")
			.format(Parameter.Format.TEXT)
			.optional(true)
			.defaultValue("/"))
		.add(new Parameter("file")
			.summary("File")
			.description("The file to upload.")
			.format(Parameter.Format.OPAQUE)
			.max(52428800)
			.optional(false))
		.create()
		.<Rest.Type>cast()
		.process((params, user) ->
		{
			aeonics.entity.Storage.Type s = Registry.of(aeonics.entity.Storage.class).get(params.asString("id"));
			if( s == null ) throw new HttpException(413, "Unknown storage");
			
			byte[] file = null;
			if( params.isMap("file") ) file = params.get("file").asString("content").getBytes(StandardCharsets.ISO_8859_1);
			else file = params.asString("file").getBytes(StandardCharsets.ISO_8859_1);
			
			String path = params.asString("path");
			if( path.endsWith("/") || s.containsPath(path) )
			{
				// path is a directory
				if( !params.isMap("file") || params.get("file").isEmpty("name") )
					throw new HttpException(413, "Missing file name, target path is a directory");
				if( !path.endsWith("/") ) path += "/";
				path += Path.of("/" + params.get("file").asString("name")).normalize().getFileName();
			}
			
			s.put(path, file);
			return null;
		})
		.url("/api/admin/storage/{id}/file")
		.method("POST")
		;
	
	private static final Endpoint.Rest.Type download = new Endpoint.Rest() { }
		.template()
		.returns("The binary file content")
		.summary("Download file")
		.description("Downloads a file from the storage.")
		.add(new Parameter("id")
			.summary("Storage")
			.description("The id of the storage.")
			.format(Parameter.Format.TEXT)
			.rule(Parameter.Rule.ID)
			.optional(false))
		.add(new Parameter("path")
			.summary("Path")
			.description("The full path to the target file.")
			.format(Parameter.Format.TEXT)
			.optional(false))
		.create()
		.<Rest.Type>cast()
		.process((params, user) ->
		{
			aeonics.entity.Storage.Type s = Registry.of(aeonics.entity.Storage.class).get(params.asString("id"));
			if( s == null ) throw new HttpException(413, "Unknown storage");
			
			String filename = Path.of("/" + params.asString("path")).normalize().getFileName().toString();
			
			return Data.map()
				.put("isHttpResponse", true)
				.put("code", 200)
				.put("body", new String(s.get(params.asString("path")), StandardCharsets.ISO_8859_1))
				.put("headers", Data.map().put("Content-Disposition", "attachment; filename=\"" + filename + "\""))
				.put("mime", Mime.guess(filename));
		})
		.url("/api/admin/storage/{id}/file")
		.method("GET")
		;
	
	private static final Endpoint.Rest.Type remove = new Endpoint.Rest() { }
		.template()
		.returns("Nothing (code 204)")
		.summary("Delete file")
		.description("Removes a file or directory from the storage.")
		.add(new Parameter("id")
			.summary("Storage")
			.description("The id of the storage.")
			.format(Parameter.Format.TEXT)
			.rule(Parameter.Rule.ID)
			.optional(false))
		.add(new Parameter("path")
			.summary("Path")
			.description("The path to remove. If the path is a directory, all files will be removed recursively.")
			.format(Parameter.Format.TEXT)
			.optional(false))
		.create()
		.<Rest.Type>cast()
		.process((params, user) ->
		{
			aeonics.entity.Storage.Type s = Registry.of(aeonics.entity.Storage.class).get(params.asString("id"));
			if( s == null ) throw new HttpException(413, "Unknown storage");
			
			s.remove(params.asString("path"));
			return null;
		})
		.url("/api/admin/storage/{id}/file")
		.method("DELETE")
		;
}
