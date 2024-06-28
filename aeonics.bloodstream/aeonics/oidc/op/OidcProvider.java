package aeonics.oidc.op;

import java.math.BigInteger;
import java.security.KeyFactory;
import java.security.PublicKey;
import java.security.spec.RSAPublicKeySpec;
import java.util.Base64;
import java.util.function.Supplier;

import aeonics.data.Data;
import aeonics.entity.Registry;
import aeonics.entity.security.Provider;
import aeonics.entity.security.User;
import aeonics.manager.Manager;
import aeonics.manager.Security;
import aeonics.manager.Vault;
import aeonics.oidc.Common;
import aeonics.template.Factory;
import aeonics.template.Parameter;
import aeonics.template.Template;
import aeonics.util.Http;

public class OidcProvider extends Provider
{
	public static class Type extends Provider.Remote
	{
		private Data urls = null;
		private Data jwks = null;
		
		private void fetchWellKnownIfNeeded()
		{
			if( urls != null && urls.isMap() ) return;
			synchronized(this)
			{
				urls = Http.get(valueOf("wellknown").asString());
			}
			
			if( !urls.isMap() ) throw new RuntimeException("Invalid /.well-known/openid-configuration file");
			boolean check = false;
			for( Data rts : urls.get("response_types_supported") )
			{
				if( rts.asString().equals("code") )
				{
					check = true;
					break;
				}
			}
			if( !check ) throw new RuntimeException("Incompatible response_types_supported");
			
			check = false;
			for( Data rts : urls.get("id_token_signing_alg_values_supported") )
			{
				if( rts.asString().equals("RS256") )
				{
					check = true;
					break;
				}
			}
			if( !check ) throw new RuntimeException("Incompatible id_token_signing_alg_values_supported");
			
			check = false;
			for( Data rts : urls.get("token_endpoint_auth_methods_supported") )
			{
				if( rts.asString().equals("client_secret_post") )
				{
					check = true;
					break;
				}
			}
			if( !check ) throw new RuntimeException("Incompatible token_endpoint_auth_methods_supported");
			
			check = false;
			for( Data rts : urls.get("grant_types_supported") )
			{
				if( rts.asString().equals("authorization_code") )
				{
					check = true;
					break;
				}
			}
			if( !check ) throw new RuntimeException("Incompatible grant_types_supported");
			
			check = false;
			for( Data rts : urls.get("scopes_supported") )
			{
				if( rts.asString().equals("openid") )
				{
					check = true;
					break;
				}
			}
			if( !check ) throw new RuntimeException("Incompatible scopes_supported");
		}
		
		private void fetchJwks(boolean force)
		{
			if( jwks != null && jwks.isMap() && !force ) return;
			fetchWellKnownIfNeeded();
			synchronized(this)
			{
				jwks = Http.get(urls.asString("jwks_uri"));
				jwks = jwks.get("keys");
			}
			if( !jwks.isList() ) throw new RuntimeException("Invalid jwks file");
		}
		
		public String issuer() { fetchWellKnownIfNeeded(); return urls.asString("issuer"); }
		public String autorizeUrl() { fetchWellKnownIfNeeded(); return urls.asString("authorization_endpoint"); }
		public String tokenUrl() { fetchWellKnownIfNeeded(); return urls.asString("token_endpoint"); }
		public String userInfoUrl() { fetchWellKnownIfNeeded(); return urls.asString("userinfo_endpoint"); }
		public PublicKey publicKey(String id)
		{
			fetchJwks(false);
			Data key = null;
			for( Data k : jwks )
			{
				if( k.asString("kid").equals(id) )
				{
					key = k;
					break;
				}
			}
			
			if( key == null )
			{
				fetchJwks(true);
				for( Data k : jwks )
				{
					if( k.asString("kid").equals(id) )
					{
						key = k;
						break;
					}
				}
			}
			
			if( key == null ) throw new RuntimeException("Unknown signing key " + id);
			
			try
			{
	            return KeyFactory.getInstance("RSA").generatePublic(
	            	new RSAPublicKeySpec(
	            		new BigInteger(1, Base64.getDecoder().decode(key.asString("n").getBytes())), 
	            		new BigInteger(1, Base64.getDecoder().decode(key.asString("e").getBytes()))));
			}
			catch(Exception e)
			{
				throw new RuntimeException("Broken signing key " + id);
			}
		}
		
		public String clientId() { return valueOf("client_id").asString(); }
		public String clientSecret() { return valueOf("client_secret").asString(); }
		public String loginPageRedirectUrl() { return Common.OP_ISSUER_URL + "/oidc/login?provider=" + id(); }
		public String redirectUri() { return Common.OP_ISSUER_URL + "/oidc/response"; }
		
		public boolean supports(String user)
		{
			User.Type u = Registry.of(User.class).get(user);
			if( u == null ) return false;
			Data match = privateData(u);
			return match != null && match.isList("sub") && match.size() > 0;
		}

		public User.Type authenticate(Data context)
		{
			if( context == null || !context.isMap() || !context.containsKey("sub") || !context.asString("iss").equals(issuer()) ) return null;
			if( !context.asString("iss").equals(issuer()) || !context.asString("aud").equals(clientId()) || (context.asLong("exp")*1000) < System.currentTimeMillis() ) return null;
			
			String sub = context.asString("sub");
			Data data = Manager.of(Vault.class).get(Manager.of(Security.class).hash(id() + "." + sub), this);
			if( data == null || data.isEmpty() ) return null;
			
			return Registry.of(User.class).get(data.asString("user"));
		}
		
		public synchronized User.Type join(Data context, User.Type existing)
		{
			if( context == null || !context.isMap() || !context.containsKey("sub") || !context.asString("iss").equals(issuer()) ) return null;
			if( !context.asString("iss").equals(issuer()) || !context.asString("aud").equals(id()) || (context.asLong("exp")*1000) < System.currentTimeMillis() ) return null;
			
			String sub = context.asString("sub");
			String name = context.containsKey("email") ? context.asString("email") : sub;
			
			// check for clash
			if( existing == null )
			{
				User.Type user = Registry.of(User.class).get(name);
				if( user != null ) existing = user;
			}
			
			if( existing != null )
			{
				// associate to existing user
				Data bind = privateData(existing);
				if( bind == null || !bind.isList("sub") ) bind = Data.map().put("sub", Data.list());
				for( Data b : bind.get("sub") )
					if( b.asString().equals(sub) )
						return existing;
				
				bind.get("sub").add(sub);
				privateData(existing, bind);
				
				// reverse bind
				Manager.of(Vault.class).set(Manager.of(Security.class).hash(id() + "." + sub), Data.map().put("user", existing.id()), this);
				return existing;
			}
			else
			{
				// create user
				existing = Factory.of(User.class).get(User.class).build().name(name);
				// bind him
				privateData(existing, Data.map().put("sub", Data.list().add(sub)));
				// reverse bind
				Manager.of(Vault.class).set(Manager.of(Security.class).hash(id() + "." + sub), Data.map().put("user", existing.id()), this);
				
				return existing;
			}
		}
		
		public synchronized void leave(User.Type user)
		{
			if( user == null ) return;
			Data p = privateData(user);
			if( p == null || p.isEmpty() ) return;
			
			privateData(user, null);
			for( Data sub : p )
				Manager.of(Vault.class).remove(Manager.of(Security.class).hash(id() + "." + sub), this);
		}
		
		@Override
		public Data export()
		{
			return super.export()
				.put("redirect_uri", redirectUri());
		}
	}
	
	protected Class<? extends Type> defaultTarget() { return OidcProvider.Type.class; }
	protected Supplier<? extends Type> defaultCreator() { return OidcProvider.Type::new; }

	@Override
	public Template<? extends Provider.Type> template()
	{
		return super.template()
			.summary("OIDC Identity Provider")
			.description("Delegates the authentication to an OIDC Identity Provider. Users must be provisionned in the system to match successfully.")
			.add(new Parameter("wellknown")
				.summary("Well known OpenID Configuration URL")
				.description("The full URL to the /.well-known/openid-configuration file.")
				.format(Parameter.Format.TEXT))
			.add(new Parameter("client_id")
				.summary("Client ID")
				.description("The client ID provided by the OIDC Provider.")
				.format(Parameter.Format.TEXT))
			.add(new Parameter("client_secret")
				.summary("Client secret")
				.description("The client secret provided by the OIDC Provider.")
				.format(Parameter.Format.PASSWORD))
			;
	}
}
