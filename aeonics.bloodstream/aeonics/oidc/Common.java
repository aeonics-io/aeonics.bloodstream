package aeonics.oidc;

import java.security.PrivateKey;
import java.security.interfaces.RSAPublicKey;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;

import aeonics.data.Data;
import aeonics.entity.Storage;
import aeonics.manager.Timeout.Tracker;
import aeonics.util.Json;

public class Common
{
	/**
	 * Issuer Identifier for the Issuer of the response. 
	 * The iss value is a case-sensitive URL using the https scheme that contains scheme, host, and optionally, 
	 * port number and path components and no query or fragment components.
	 */
	public static String OP_ISSUER_URL = "https://localhost";
	
	/**
	 * lifetime validity of the access token in seconds
	 */
	public static long OP_ACCESS_TOKEN_TTL = 86400;
	
	/**
	 * lifetime validity of the id token in seconds
	 */
	public static long OP_ID_TOKEN_TTL = 300;
	
	/**
	 * lifetime validity of the refresh token in seconds
	 */
	public static long OP_REFRESH_TOKEN_TTL = 2592000;
	
	/**
	 * lifetime validity of the authentication flow in seconds
	 */
	public static long OP_AUTH_CODE_TTL = 180;
	
	/**
	 * maximum number of unfinished pending authentication requests
	 */
	public static int OP_AUTH_CODE_MAX = 5000;
	
	/**
	 * private key used for signing the id token 
	 */
	public static PrivateKey OP_PRIVATE_KEY = null;
	
	/**
	 * private key used to verify the id token signature 
	 */
	public static RSAPublicKey OP_PUBLIC_KEY = null;
	
	/**
	 * the storage to store all the tokens and code
	 */
	public static Storage.Type storage = null;
	
	/**
	 * the timeout tracker
	 */
	public static Tracker<Void> tracker = new Tracker<Void>(null)
	{
		private long next = 0;
		public long delay()
		{
			if( next == 0 || next < System.currentTimeMillis() ) checkNow();
			return next - System.currentTimeMillis();
		}
		
		private void checkNow()
		{
			final Long now = System.currentTimeMillis();
			AtomicLong min = new AtomicLong(Math.min(OP_REFRESH_TOKEN_TTL*1000, OP_AUTH_CODE_TTL*1000));
			
			if( storage == null )
			{
				Common.Code.local.entrySet().removeIf((t) -> 
				{
					if( t == null ) return true;
					
					long left = (t.getValue().asLong("_time") + OP_AUTH_CODE_TTL*1000) - now;
					
					if( left <= 0 ) return true;
					else
					{
						min.set(Math.min(min.get(), left));
						return false;
					}
				});
				
				Common.Refresh.local.entrySet().removeIf((t) -> 
				{
					if( t == null ) return true;
					
					long left = (t.getValue().asLong("_time") + OP_REFRESH_TOKEN_TTL*1000) - now;
					
					if( left <= 0 ) return true;
					else
					{
						min.set(Math.min(min.get(), left));
						return false;
					}
				});
			}
			else
			{
				for( String code : storage.list(Common.Code.path) )
				{
					Data m = storage.getData(code);
					if( m == null || m.isEmpty() ) continue;
					
					long left = (m.asLong("_time") + OP_AUTH_CODE_TTL*1000) - now;
					
					if( left <= 0 ) storage.remove(code);
					else min.set(Math.min(min.get(), left));
				}
				
				for( String token : storage.list(Common.Refresh.path) )
				{
					Data m = storage.getData(token);
					if( m == null || m.isEmpty() ) continue;
					
					long left = (m.asLong("_time") + OP_REFRESH_TOKEN_TTL*1000) - now;
					
					if( left <= 0 ) storage.remove(token);
					else min.set(Math.min(min.get(), left));
				}
			}
			
			if( min.get() <= 0 ) min.set(Math.min(OP_REFRESH_TOKEN_TTL*1000, OP_AUTH_CODE_TTL*1000));
			next = now + min.get();
		}
	};
	
	public static class Code
	{
		static ConcurrentHashMap<String, Data> local = new ConcurrentHashMap<>();
		
		public static String path = "code/";
		
		public static void put(String code, Data state)
		{
			Storage.Type s = storage;
			if( s != null )
				s.put(path + code, state);
			else
				local.put(code, state);
		}
		
		public static Data get(String code)
		{
			Storage.Type s = storage;
			if( s != null )
			{
				byte[] m = s.get(path + code);
				if( m == null || m.length == 0 ) return null;
				return Json.decode(new String(m));
			}
			else
				return local.get(code);
		}
		
		public static Data remove(String code)
		{
			Storage.Type s = storage;
			if( s != null )
			{
				byte[] m = s.get(path + code);
				if( m == null ) return null;
				
				s.remove(path + code);
				return Json.decode(new String(m));
			}
			else
				return local.remove(code);
		}
		
		public static int count()
		{
			Storage.Type s = storage;
			if( s != null )
				return s.tree(path).size();
			else
				return local.size();
		}
	}
	
	public static class Refresh
	{
		static ConcurrentHashMap<String, Data> local = new ConcurrentHashMap<>();
		
		public static String path = "refresh/";
		
		public static void put(String code, Data state)
		{
			Storage.Type s = storage;
			if( s != null )
				s.put(path + code, state);
			else
				local.put(code, state);
		}
		
		public static Data get(String code)
		{
			Storage.Type s = storage;
			if( s != null )
			{
				byte[] m = s.get(path + code);
				if( m == null || m.length == 0 ) return null;
				return Json.decode(new String(m));
			}
			else
				return local.get(code);
		}
		
		public static Data remove(String code)
		{
			Storage.Type s = storage;
			if( s != null )
			{
				byte[] m = s.get(path + code);
				if( m == null ) return null;
				
				s.remove(path + code);
				return Json.decode(new String(m));
			}
			else
				return local.remove(code);
		}
		
		public static int count()
		{
			Storage.Type s = storage;
			if( s != null )
				return s.tree(path).size();
			else
				return local.size();
		}
	}
	
	public static class OTP
	{
		static ConcurrentHashMap<String, Data> local = new ConcurrentHashMap<>();
		
		public static String path = "otp/";
		
		public static void put(String code, Data state)
		{
			Storage.Type s = storage;
			if( s != null )
				s.put(path + code, state);
			else
				local.put(code, state);
		}
		
		public static Data get(String code)
		{
			Storage.Type s = storage;
			if( s != null )
			{
				byte[] m = s.get(path + code);
				if( m == null || m.length == 0 ) return null;
				return Json.decode(new String(m));
			}
			else
				return local.get(code);
		}
		
		public static Data remove(String code)
		{
			Storage.Type s = storage;
			if( s != null )
			{
				byte[] m = s.get(path + code);
				if( m == null ) return null;
				
				s.remove(path + code);
				return Json.decode(new String(m));
			}
			else
				return local.remove(code);
		}
		
		public static int count()
		{
			Storage.Type s = storage;
			if( s != null )
				return s.tree(path).size();
			else
				return local.size();
		}
	}
}
