package aeonics.oidc;

import java.net.URLEncoder;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;

import aeonics.data.Data;
import aeonics.entity.Registry;
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
	
	private static final char[] BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567".toCharArray();
	private static String base32Encode(byte[] data)
	{
		StringBuilder result = new StringBuilder();
        int bitCount = 0;
        int currentByte = 0;
        
        for (byte b : data)
        {
            currentByte <<= 8;
            currentByte |= b & 0xFF;
            bitCount += 8;
            
            while (bitCount >= 5) {
                int index = (currentByte >>> (bitCount - 5)) & 0x1F;
                result.append(BASE32_ALPHABET[index]);
                bitCount -= 5;
            }
        }
        
        if (bitCount > 0)
        {
            currentByte <<= (5 - bitCount);
            int index = currentByte & 0x1F;
            result.append(BASE32_ALPHABET[index]);
        }
        
        return result.toString();
	}

	private static final int[] REVERSE_BASE32 = new int[] { 26, 27, 28 , 29 , 30, 31, -1, -1, -1, -1, -1, -1, -1, -1, -1, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25 };
	private static byte[] base32Decode(String value)
	{
		byte[] result = new byte[(value.length() * 5) / 8];
		int resultIndex = 0;
		int currentByte = 0;
		int bitCount = 0;
		
		for( char c : value.toCharArray() )
		{
			int i = c - 50;
			if( i < 0 || i >= REVERSE_BASE32.length ) throw new IllegalArgumentException("Invalid character in Base32 string: " + c);
			i = REVERSE_BASE32[i];
		
			currentByte <<= 5;
			currentByte |= i & 0x1F;
			bitCount += 5;

		    if (bitCount >= 8)
		    {
				result[resultIndex++] = (byte) ((currentByte >> (bitCount - 8)) & 0xFF);
				bitCount -= 8;
		    }
		}
		
		return result;
	}
	
	private static byte[] generateSecret() throws Exception
	{
		byte[] hash = Manager.of(Security.class).randomHash().getBytes();
		byte[] secret = new byte[6];
		
		for( int i = 0; i < 6; i++ ) secret[i] = hash[i];
		for( int i = 6; i < hash.length; i++ ) secret[i%6] ^= hash[i];
		
		return secret;
	}

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
			
			// https://github.com/google/google-authenticator/wiki/Key-Uri-Format
	    	// otpauth://totp/ACME%20Co:john.doe@email.com?secret=HXDMVJECJJWSRB3HWIZR4IFUGFTMXBOZ&issuer=ACME%20Co&algorithm=SHA1&digits=6&period=30
			
			if( user == User.ANONYMOUS || user == User.SYSTEM )
				throw new HttpException(403, Data.map().put("error", "invalid_request").put("error_description", "Invalid user"));
			if( enrolled(user) )
				throw new HttpException(400, Data.map().put("error", "invalid_request").put("error_description", "Already enrolled"));
			
			Data info = Data.map()
				.put("secret", base32Encode(generateSecret()))
				.put("period", Manager.of(Config.class).get(Security.class, "otp.period"))
				.put("digits", Manager.of(Config.class).get(Security.class, "otp.digits"))
				.put("algorithm", Manager.of(Config.class).get(Security.class, "otp.algorithm"));
			
			// clone info to avoid modifications
			return Data.map()
				.put("secret", info.get("secret"))
				.put("period", info.get("period"))
				.put("digits", info.get("digits"))
				.put("algorithm", info.get("algorithm"))
				.put("url", "otpauth://totp/" 
					+ URLEncoder.encode(Manager.of(Config.class).get(Security.class, "otp.issuer").asString(), StandardCharsets.UTF_8).replace("+", "%20") + ":" 
					+ URLEncoder.encode(user.name(), StandardCharsets.UTF_8).replace("+", "%20") + "?" +
				"secret=" + info.get("secret") +
				"&issuer=" + URLEncoder.encode(Manager.of(Config.class).get(Security.class, "otp.issuer").asString(), StandardCharsets.UTF_8).replace("+", "%20") +
				"&algorithm=" + info.asString("algorithm") +
				"&digits=" + info.asString("digits") +
				"&period=" + info.asString("period"));
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
			
			// https://github.com/google/google-authenticator/wiki/Key-Uri-Format
	    	// otpauth://totp/ACME%20Co:john.doe@email.com?secret=HXDMVJECJJWSRB3HWIZR4IFUGFTMXBOZ&issuer=ACME%20Co&algorithm=SHA1&digits=6&period=30
			
			if( user == User.ANONYMOUS || user == User.SYSTEM )
				throw new HttpException(403, Data.map().put("error", "invalid_request").put("error_description", "Invalid user"));
			if( enrolled(user) )
				throw new HttpException(400, Data.map().put("error", "invalid_request").put("error_description", "Already enrolled"));
			
			byte[] secret = base32Decode(params.asString("secret"));
			long now = System.currentTimeMillis();
			
			if( !checkAt(params.asString("algorithm"), params.asInt("period"), params.asInt("digits"), secret, params.asString("check"), now) && 
				!checkAt(params.asString("algorithm"), params.asInt("period"), params.asInt("digits"), secret, params.asString("check"), now - (params.asLong("period") * 1000L)) )
				throw new HttpException(400, Data.map().put("error", "invalid_request").put("error_description", "Invalid verification code"));
			
			Common.OTP.put(user.id(), Data.map()
				.put("secret", params.asString("secret"))
				.put("period", params.asInt("period"))
				.put("digits", params.asInt("digits"))
				.put("algorithm", params.asString("algorithm")));

			return Data.empty();
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
			if( !check(user, params.asString("otp")) )
				throw new HttpException(403, Data.map().put("error", "invalid_request").put("error_description", "OTP code mismatch"));
			
			Common.OTP.remove(user.id());
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
			
			return Data.map().put("exists", enrolled(user));
		})
		.url("/oauth/otp/exists")
		.method("GET")
		;
	
	public static void register()
	{
		// calling this method will force initialization of all private static members
		// all endpoints will be added to the registry automatically
	}
	
	/**
	 * Checks if the specified user is enrolled for OTP
	 * @param user the user to check
	 * @return true if the user is enrolled for OTP
	 */
	public static boolean enrolled(User.Type user)
	{
		if( user == User.ANONYMOUS || user == User.SYSTEM ) return false;
		
		Data info = Common.OTP.get(user.id());
		if( info == null || info.isEmpty() ) return false;
		else return true;
	}
	
	/**
	 * Checks the given OTP for the specified user
	 * @param user the user to check
	 * @param otp the otp to check
	 * @return true if the otp matches
	 */
	public static boolean check(User.Type user, String otp) 
	{
		synchronized(user)
		{
			try
			{
				if( user == User.ANONYMOUS || user == User.SYSTEM ) return false;
				
				Data info = Common.OTP.get(user.id());
				if( info == null || info.isEmpty() || info.asString("latest").equals(otp) ) return false;
				
				long now = System.currentTimeMillis();
				byte[] secret = base32Decode(info.asString("secret"));
				
				if( !checkAt(info.asString("algorithm"), info.asInt("period"), info.asInt("digits"), secret, otp, now) && 
					!checkAt(info.asString("algorithm"), info.asInt("period"), info.asInt("digits"), secret, otp, now - (info.asLong("period") * 1000L)) ) return false;
				
				// from here, code did match.
				// keep the last successful match to prevent replay attacks
				info.put("latest", otp);
				Common.OTP.put(user.id(), info);
				return true;
			}
			catch(Exception e)
			{
				Manager.of(Logger.class).warning(TOTP.class, e);
				return false;
			}
		}
	}
	
	private static boolean checkAt(String algorithm, int period, int digits, byte[] secret, String otp, long time) throws Exception
	{
		int current = Integer.parseInt(otp);
		
		long timeslice = time / 1000L / period;
        
        Mac mac = Mac.getInstance("Hmac" + algorithm);
        mac.init(new SecretKeySpec(secret, "Hmac" + algorithm));
        byte[] hmac = mac.doFinal(ByteBuffer.allocate(8).putLong(timeslice).array());
        
        int offset = hmac[hmac.length - 1] & 0x0f;
        int binary = ((hmac[offset] & 0x7f) << 24) |
                      ((hmac[offset + 1] & 0xff) << 16) |
                      ((hmac[offset + 2] & 0xff) << 8) |
                      (hmac[offset + 3] & 0xff);
        int totp = binary % (int) Math.pow(10, digits);
        
        return current == totp;
	}
}
