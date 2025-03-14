package aeonics.oidc;

import java.net.URLEncoder;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;

import aeonics.data.Data;
import aeonics.entity.Registry;
import aeonics.entity.security.Multifactor;
import aeonics.entity.security.User;
import aeonics.http.Endpoint;
import aeonics.http.HttpException;
import aeonics.http.Endpoint.Rest;
import aeonics.template.Parameter;
import aeonics.manager.Config;
import aeonics.manager.Logger;
import aeonics.manager.Manager;
import aeonics.manager.Security;

@SuppressWarnings("unused")
public class TOTP 
{
	private TOTP() { /* no instances */ }

	private static final Endpoint.Rest.Type generate = new Endpoint.Rest() { }
		.template()
		.summary("Generate TOTP parameters")
		.description("This endpoint generates randomized TOTP parameters but does not activate them. You should call the register endpoint with the same parameters and a valid code to enroll.")
		.add(new Parameter("code")
			.summary("Authentication code")
			.description("Instead of providing a direct authentication, this endpoint can be called with a temporary authentication code to enroll the user with TOTP.")
			.optional(true)
			.format(Parameter.Format.TEXT))
		.create()
		.<Rest.Type>cast()
		.process((params, user, request) ->
		{
			if( !request.metadata().asBool("tls") )
				throw new HttpException(400, Data.map().put("error", "invalid_request").put("error_description", "This endpoint must be called using a secure TLS connection."));
			
			if( !params.isEmpty("code") )
			{
				Data data = Common.Code.get(params.asString("code"));
				if( data == null )
					throw new HttpException(400, Data.map().put("error", "invalid_request").put("error_description", "Invalid code"));
				user = Registry.of(User.class).get(data.asString("otp_user"));
				if( user == null )
				{
					Common.Code.remove(params.asString("code"));
					throw new HttpException(400, Data.map().put("error", "invalid_request").put("error_description", "Invalid code"));
				}
			}
			
			if( user == User.ANONYMOUS || user == User.SYSTEM )
				throw new HttpException(403, Data.map().put("error", "invalid_request").put("error_description", "Invalid user"));
			
			// register on the first MFA found
			for( Multifactor.Type m : Registry.of(Multifactor.class) )
			{
				if( m.enrolled(user) )
					throw new HttpException(400, Data.map().put("error", "invalid_request").put("error_description", "Already enrolled"));
				
				Data info = m.enroll(user, null);
				m.forget(user);
				return info;
			}
			
			throw new HttpException(500, Data.map().put("error", "server_error").put("error_description", "Multifactor provider not available")); 
		})
		.url("/oauth/otp/generate")
		.method("POST")
		;
		
	private static final Endpoint.Rest.Type register = new Endpoint.Rest() { }
		.template()
		.summary("Enroll with TOTP")
		.description("This endpoint can be used to enable TOTP for the current user using the provided parameters. You must also provide a valid TOTP code to match the provided parameters.")
		.add(new Parameter("code")
			.summary("Authentication code")
			.description("Instead of providing a direct authentication, this endpoint can be called with a temporary authentication code to enroll the user with TOTP.")
			.optional(true)
			.format(Parameter.Format.TEXT))
		.add(new Parameter("period")
			.summary("Time period")
			.description("The time window validity for the code in seconds. Usually 30 seconds.")
			.optional(false)
			.rule(Parameter.Rule.DIGIT)
			.format(Parameter.Format.NUMBER))
		.add(new Parameter("digits")
			.summary("Number of digits")
			.description("The length of the code. Usually 6 digits.")
			.optional(false)
			.rule(Parameter.Rule.DIGIT)
			.format(Parameter.Format.NUMBER))
		.add(new Parameter("algorithm")
			.summary("Hash algorithm")
			.description("The name of the hash algorithm. Usually \"SHA1\".")
			.optional(false)
			.format(Parameter.Format.TEXT))
		.add(new Parameter("secret")
			.summary("Secret key")
			.description("The random secret key in base32 format.")
			.optional(false)
			.format(Parameter.Format.TEXT))
		.add(new Parameter("check")
			.summary("Code check")
			.description("A valid code that has been generated using the provided parameters to ensure proper enrollment.")
			.optional(false)
			.rule(Parameter.Rule.DIGIT)
			.format(Parameter.Format.NUMBER))
		.create()
		.<Rest.Type>cast()
		.process((params, user, request) ->
		{
			if( !request.metadata().asBool("tls") )
				throw new HttpException(400, Data.map().put("error", "invalid_request").put("error_description", "This endpoint must be called using a secure TLS connection."));
			
			if( !params.isEmpty("code") )
			{
				Data data = Common.Code.get(params.asString("code"));
				if( data == null )
					throw new HttpException(400, Data.map().put("error", "invalid_request").put("error_description", "Invalid code"));
				user = Registry.of(User.class).get(data.asString("otp_user"));
				if( user == null )
				{
					Common.Code.remove(params.asString("code"));
					throw new HttpException(400, Data.map().put("error", "invalid_request").put("error_description", "Invalid code"));
				}
			}
			
			if( user == User.ANONYMOUS || user == User.SYSTEM )
				throw new HttpException(403, Data.map().put("error", "invalid_request").put("error_description", "Invalid user"));
			
			// register on the first MFA found
			for( Multifactor.Type m : Registry.of(Multifactor.class) )
			{
				if( m.enrolled(user) )
					throw new HttpException(400, Data.map().put("error", "invalid_request").put("error_description", "Already enrolled"));
				
				m.enroll(user, Data.map().put("secret", params.asString("secret")));
				if( !m.check(user, Data.map().put("otp", params.asString("check"))) )
				{
					m.forget(user);
					throw new HttpException(400, Data.map().put("error", "invalid_request").put("error_description", "Invalid verification code"));
				}
				return Data.empty();
			}
			
			throw new HttpException(500, Data.map().put("error", "server_error").put("error_description", "Multifactor provider not available"));
		})
		.url("/oauth/otp/register")
		.method("POST")
		;
	
	private static final Endpoint.Rest.Type unregister = new Endpoint.Rest() { }
		.template()
		.summary("Unregister from TOTP")
		.description("This endpoint can be used to disable TOTP for the current user.")
		.add(new Parameter("otp")
			.summary("OTP")
			.description("The OTP is required to be able to opt out of OTP as a proof of ownership.")
			.optional(false)
			.format(Parameter.Format.TEXT))
		.create()
		.<Rest.Type>cast()
		.process((params, user, request) ->
		{
			if( !request.metadata().asBool("tls") )
				throw new HttpException(400, Data.map().put("error", "invalid_request").put("error_description", "This endpoint must be called using a secure TLS connection."));
			
			if( user == User.ANONYMOUS || user == User.SYSTEM )
				throw new HttpException(403, Data.map().put("error", "invalid_request").put("error_description", "Invalid user"));
			
			for( Multifactor.Type m : Registry.of(Multifactor.class) )
			{
				if( m.enrolled(user) )
				{
					if( !m.check(user, Data.map().put("otp", params.asString("otp"))) )
						throw new HttpException(403, Data.map().put("error", "invalid_request").put("error_description", "OTP code mismatch"));
					m.forget(user);
				}
			}
			
			return null;
		})
		.url("/oauth/otp/unregister")
		.method("POST")
		;
	
	private static final Endpoint.Rest.Type exists = new Endpoint.Rest() { }
		.template()
		.summary("Check for TOTP")
		.description("This endpoint can be used to check if the current user has enrolled with TOTP.")
		.add(new Parameter("code")
			.summary("Authentication code")
			.description("Instead of providing a direct authentication, this endpoint can be called with a temporary authentication code to check if the target user has enrolled with TOTP.")
			.optional(true)
			.format(Parameter.Format.TEXT))
		.create()
		.<Rest.Type>cast()
		.process((params, user, request) ->
		{
			if( !request.metadata().asBool("tls") )
				throw new HttpException(400, Data.map().put("error", "invalid_request").put("error_description", "This endpoint must be called using a secure TLS connection."));
			
			if( !params.isEmpty("code") )
			{
				Data data = Common.Code.get(params.asString("code"));
				if( data == null )
					throw new HttpException(400, Data.map().put("error", "invalid_request").put("error_description", "Invalid code"));
				user = Registry.of(User.class).get(data.asString("otp_user"));
				if( user == null )
				{
					Common.Code.remove(params.asString("code"));
					throw new HttpException(400, Data.map().put("error", "invalid_request").put("error_description", "Invalid code"));
				}
			}
			
			boolean exists = false;
			for( Multifactor.Type m : Registry.of(Multifactor.class) )
				if( m.enrolled(user) )
					exists = true;
			return Data.map().put("exists", exists);
		})
		.url("/oauth/otp/exists")
		.method("GET")
		;
	
	public static void register()
	{
		// calling this method will force initialization of all private static members
		// all endpoints will be added to the registry automatically
	}
}
