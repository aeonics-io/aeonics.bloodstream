package aeonics.oidc;

import java.net.URLEncoder;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;

import aeonics.data.Data;
import aeonics.entity.Action;
import aeonics.entity.security.User;
import aeonics.http.Endpoint;
import aeonics.http.Endpoint.Rest;
import aeonics.template.Parameter;
import aeonics.manager.Config;
import aeonics.manager.Logger;
import aeonics.manager.Manager;
import aeonics.manager.Security;

public class TOTP 
{
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
	
	private static byte[] secretFromUserAndSalt(User.Type user, long salt) throws Throwable
	{
		byte[] hash = Manager.of(Security.class).hash(user.name() + "#" + salt).getBytes();
		byte[] secret = new byte[6];
		
		for( int i = 0; i < 6; i++ ) secret[i] = hash[i];
		for( int i = 6; i < hash.length; i++ ) secret[i%6] ^= hash[i];
		
		return secret;
	}

	private static final Endpoint.Rest.Type register = new Endpoint.Rest() { }
		.template()
		.summary("Enroll with TOTP")
		.description("This endpoint can be used to enable TOTP for the current user.")
		.build()
		.<Rest.Type>cast()
		.process((params, user, request) ->
		{
			if( !request.metadata().asBool("tls") )
				throw new SecurityException("This endpoint must be called using a secure TLS connection.");
			
			// https://github.com/google/google-authenticator/wiki/Key-Uri-Format
	    	// otpauth://totp/ACME%20Co:john.doe@email.com?secret=HXDMVJECJJWSRB3HWIZR4IFUGFTMXBOZ&issuer=ACME%20Co&algorithm=SHA1&digits=6&period=30
			
			if( user == User.ANONYMOUS || user == User.SYSTEM ) throw new SecurityException("Invalid user");
			if( enrolled(user) ) throw new SecurityException("Already enrolled");
			
			Data info = Data.map()
				.put("salt", SecureRandom.getInstanceStrong().nextLong())
				.put("period", Manager.of(Config.class).get(Security.class, "otp.period"))
				.put("digits", Manager.of(Config.class).get(Security.class, "otp.digits"))
				.put("algorithm", Manager.of(Config.class).get(Security.class, "otp.algorithm"));
			Common.OTP.put(user.id().toString(), info);
			
			// generate secret and url
			String secret = base32Encode(secretFromUserAndSalt(user, info.asLong("salt")));
			info.put("secret", secret);
			info.put("url", "otpauth://totp/" 
					+ URLEncoder.encode(Manager.of(Config.class).get(Security.class, "otp.issuer").asString(), StandardCharsets.UTF_8) + ":" 
					+ URLEncoder.encode(user.name(), StandardCharsets.UTF_8) + "?" +
				"secret=" + base32Encode(secretFromUserAndSalt(user, info.asLong("salt"))) +
				"&issuer=" + URLEncoder.encode(Manager.of(Config.class).get(Security.class, "otp.issuer").asString(), StandardCharsets.UTF_8) +
				"&algorithm=" + info.asString("algorithm") +
				"&digits=" + info.asString("digits") +
				"&period=" + info.asString("period"));
			
			// remove the salt, it is private
			info.remove("salt");
			
			return info;
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
			.optional(false))
		.build()
		.<Rest.Type>cast()
		.process((params, user, request) ->
		{
			if( !request.metadata().asBool("tls") )
				throw new SecurityException("This endpoint must be called using a secure TLS connection.");
			
			if( user == User.ANONYMOUS || user == User.SYSTEM ) throw new SecurityException("Invalid user");
			if( !check(user, params.asString("otp")) ) throw new SecurityException("Invalid OTP");
			
			Common.OTP.remove(user.id().toString());
			return null;
		})
		.url("/oauth/otp/unregister")
		.method("POST")
		;
	
	private static final Endpoint.Rest.Type exists = new Endpoint.Rest() { }
		.template()
		.summary("Check for TOTP")
		.description("This endpoint can be used to check if the current user has enrolled with TOTP.")
		.build()
		.<Rest.Type>cast()
		.process((params, user, request) ->
		{
			if( !request.metadata().asBool("tls") )
				throw new SecurityException("This endpoint must be called using a secure TLS connection.");
			
			return Data.map().put("exists", enrolled(user));
		})
		.url("/oauth/otp/exists")
		.method("GET")
		;
	
	public static void register(Action.Type router)
	{
		router.addRelation("endpoints", register);
		router.addRelation("endpoints", unregister);
		router.addRelation("endpoints", exists);
	}
	
	/**
	 * Checks if the specified user is enrolled for OTP
	 * @param user the user to check
	 * @return true if the user is enrolled for OTP
	 */
	public static boolean enrolled(User.Type user)
	{
		if( user == User.ANONYMOUS || user == User.SYSTEM ) return false;
		
		Data info = Common.OTP.get(user.id().toString());
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
		try
		{
			if( user == User.ANONYMOUS || user == User.SYSTEM ) return false;
			
			Data info = Common.OTP.get(user.id().toString());
			if( info == null || info.isEmpty() ) return false;
			
			long now = System.currentTimeMillis();
			byte[] secret = secretFromUserAndSalt(user, info.asLong("salt"));
			
			if( checkAt(info, secret, otp, now) ) return true;
			if( checkAt(info, secret, otp, now - (info.asLong("period") * 1000L)) ) return true;
			return false;
		}
		catch(Throwable e)
		{
			Manager.of(Logger.class).warning(TOTP.class, e);
			return false;
		}
	}
	
	private static boolean checkAt(Data info, byte[] secret, String otp, long time) throws Exception
	{
		long timeslice = time / 1000L / info.asLong("period");
        
        Mac mac = Mac.getInstance("Hmac" + info.asString("algorithm"));
        mac.init(new SecretKeySpec(secret, "Hmac" + info.asString("algorithm")));
        byte[] hmac = mac.doFinal(ByteBuffer.allocate(8).putLong(timeslice).array());
        
        int offset = hmac[hmac.length - 1] & 0x0f;
        int binary = ((hmac[offset] & 0x7f) << 24) |
                      ((hmac[offset + 1] & 0xff) << 16) |
                      ((hmac[offset + 2] & 0xff) << 8) |
                      (hmac[offset + 3] & 0xff);
        int totp = binary % (int) Math.pow(10, info.asInt("digits"));
        
        return otp.equals("" + totp);
	}
}
