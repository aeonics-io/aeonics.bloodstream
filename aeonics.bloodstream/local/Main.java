package local;

import java.nio.file.Files;
import java.nio.file.Paths;
import java.security.KeyFactory;
import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.interfaces.RSAPublicKey;
import java.security.spec.PKCS8EncodedKeySpec;
import java.security.spec.X509EncodedKeySpec;
import java.util.Base64;

import aeonics.Plugin;
import aeonics.data.Data;
import aeonics.entity.Probe;
import aeonics.entity.Registry;
import aeonics.entity.Storage;
import aeonics.entity.security.Group;
import aeonics.entity.security.Policy;
import aeonics.entity.security.Provider;
import aeonics.entity.security.Role;
import aeonics.entity.security.Rule;
import aeonics.manager.Config;
import aeonics.manager.Lifecycle;
import aeonics.manager.Lifecycle.Phase;
import aeonics.manager.Logger;
import aeonics.manager.Manager;
import aeonics.manager.Monitor;
import aeonics.manager.Security;
import aeonics.manager.Timeout;
import aeonics.manager.Vault;
import aeonics.monitoring.Monitoring;
import aeonics.oidc.Common;
import aeonics.oidc.op.OidcProvider;
import aeonics.oidc.rp.RelyingParty;
import aeonics.template.Factory;
import aeonics.template.Parameter;

public class Main extends Plugin
{
	public String summary() { return "Bloodstream v1.0.0"; }
	public String description() { return "Aeonics Bloodstream Enterprise Suite"; }
	
	public void start()
	{
		Lifecycle.on(Phase.LOAD, this::onLoad);
		Lifecycle.on(Phase.CONFIG, this::onConfig);
		Lifecycle.on(Phase.RUN, this::onRun);
		Lifecycle.after(Phase.RUN, this::afterRun);
	}
	
	private void onLoad()
	{
		Factory.add(new OidcProvider());
		Factory.add(new RelyingParty());
	}
	
	private void onConfig()
	{
		Config c = Manager.of(Config.class);
		
		c.declare(Monitor.class, new Parameter("storage")
				.summary("Monitor data storage")
				.description("The name or ID of the storage entity where monitoring data will be persisted. This is normally set by the system on startup, but it can be changed afterwards.")
				.format(Parameter.Format.TEXT)
				.optional(false));
		c.declare(Monitor.class, new Parameter("path")
				.summary("Monitor data storage path")
				.description("The default storage location for the monitor data.")
				.format(Parameter.Format.TEXT)
				.optional(true)
				.defaultValue("stats"));
		c.declare(Security.class, new Parameter("path")
				.summary("Security data storage path")
				.description("The default storage location for the security data.")
				.format(Parameter.Format.TEXT)
				.optional(true)
				.defaultValue("security"));
		c.declare(RelyingParty.class, new Parameter("name")
				.summary("Default Relying Party Name")
				.description("The display name of the default relying party for authentication.")
				.format(Parameter.Format.TEXT)
				.optional(true)
				.defaultValue("Local System"));
		
		c.declare(Security.class, new Parameter("otp.initialized")
			.summary("Default OTP has been initialized")
			.description("This parameter defines if the default MFA has already been initialized (true) or if it should done when starting the run phase (false)."
				+ " This is normally set by the system to detect an initial snapshot.")
			.format(Parameter.Format.BOOLEAN)
			.rule(Parameter.Rule.BOOLEAN)
			.optional(true)
			.defaultValue(false));
		
		// ===========================
		// OP stuff
		
		c.declare(Security.class, new Parameter("oidcissuer")
			.summary("OIDC OP issuer url")
			.description("The url of this OIDC OP instance.")
			.rule(Parameter.Rule.URL)
			.format(Parameter.Format.TEXT)
			.defaultValue("https://localhost"));
		c.declare(Security.class, new Parameter("oidc.op.access_token.ttl")
			.summary("OIDC OP access token validity")
			.description("The validity period in seconds for access tokens issued by this OIDC OP.")
			.rule(Parameter.Rule.DIGIT)
			.format(Parameter.Format.NUMBER)
			.defaultValue(86400));
		c.declare(Security.class, new Parameter("oidc.op.id_token.ttl")
			.summary("OIDC OP id token validity")
			.description("The validity period in seconds for id tokens issued by this OIDC OP.")
			.rule(Parameter.Rule.DIGIT)
			.format(Parameter.Format.NUMBER)
			.defaultValue(300));
		c.declare(Security.class, new Parameter("oidc.op.refresh_token.ttl")
			.summary("OIDC OP refresh token validity")
			.description("The validity period in seconds for refresh tokens issued by this OIDC OP.")
			.rule(Parameter.Rule.DIGIT)
			.format(Parameter.Format.NUMBER)
			.defaultValue(2592000));
		c.declare(Security.class, new Parameter("oidc.op.auth_code.ttl")
			.summary("OIDC OP authentication code validity")
			.description("The validity period in seconds for the authentication code in this OIDC OP. This means that the user must complete authentication within this time window.")
			.rule(Parameter.Rule.DIGIT)
			.format(Parameter.Format.NUMBER)
			.defaultValue(180));
		c.declare(Security.class, new Parameter("oidc.op.auth_code.max")
			.summary("OIDC OP maximum concurrent authentication flows")
			.description("The maximum number of concurrent authentication flows in this OIDC OP. This limit is set to avoid spam.")
			.rule(Parameter.Rule.DIGIT)
			.format(Parameter.Format.NUMBER)
			.defaultValue(5000));
		c.declare(Security.class, new Parameter("oidc.op.jwt.public")
			.summary("OIDC OP JWT public key")
			.description("The public key used by this OIDC OP to verify the JWT signature. The key should be provided in PEM-encoded base64 format. It may be the path to a local file.")
			.format(Parameter.Format.TEXT)
			.defaultValue(() -> Data.empty()));
		c.declare(Security.class, new Parameter("oidc.op.jwt.private")
			.summary("OIDC OP JWT private key")
			.description("The private key used by this OIDC OP to sign the JWT. Leave this value empty to let the system generate and manage the key in the vault (recommended). "
				+ "It may be the path to a local PEM-encoded file managed outside of the system. If a PEM-encoded base64 key is provided directly, "
				+ "it is moved to the vault and cleared from the config.")
			.format(Parameter.Format.TEXT)
			.defaultValue(() -> Data.empty()));
		c.declare(Security.class, new Parameter("oidc.op.storage")
			.summary("OIDC OP storage")
			.description("The name or id of the storage for this OIDC OP. If the storage does not exist, a local temporary (ouf-of-storage) location is used instead.")
			.format(Parameter.Format.TEXT)
			.defaultValue(() -> Data.empty()));
		c.declare(Security.class, new Parameter("local.provider")
			.summary("Local OIDC identity provider")
			.description("The ID of the local OIDC OP. This parameter is set automatically by the system on startup and should not be changed.")
			.format(Parameter.Format.TEXT)
			.rule(Parameter.Rule.ID)
			.optional(false));
		
		new Probe() {}
			.template()
			.summary("Registry")
			.description("This probe returns the current number of registry categories and total number of entities.")
			.create()
			.source(() ->
			{
				int categories = 0;
				int entities = 0;
				
				for( Registry<?> r : Registry.all() )
				{
					categories++;
					entities += r.size();
				}
					
				return Data.map().put("categories", categories).put("entities", entities);
			})
			.name("registry");
			
		new Probe() {}
			.template()
			.summary("Factory")
			.description("This probe returns the current number of factory categories and total number of templates.")
			.create()
			.source(() ->
			{
				int categories = 0;
				int templates = 0;
				
				for( Factory<?> f : Factory.all() )
				{
					categories++;
					templates += f.size();
				}
					
				return Data.map().put("categories", categories).put("entities", templates);
			})
			.name("factory");
	}
	
	private void onRun()
	{
		// bind the config
		Config c = Manager.of(Config.class);
		c.watch(Security.class, "oidcissuer", (key, value) ->
		{
			Common.OP_ISSUER_URL = value.asString();
			String issuer = value.asString();
			
			// the local self-provider and its relying party track the platform issuer
			String localProviderId = Manager.of(Config.class).get(Security.class, "local.provider").asString();
			if( !localProviderId.isBlank() )
			{
				OidcProvider.Type provider = Registry.of(Provider.class).get(localProviderId);	
				if( provider != null )
				{
					provider.parameter("wellknown", issuer + "/.well-known/openid-configuration");
					provider.refresh();
					
					RelyingParty.Type rp = Registry.of(RelyingParty.class).get(provider.clientId());
					if( rp != null )
						rp.parameter("redirect_uri", issuer + "/oidc/response");
				}
			}
		});
		c.watch(Security.class, "oidc.op.access_token.ttl", (key, value) -> Common.OP_ACCESS_TOKEN_TTL = value.asLong());
		c.watch(Security.class, "oidc.op.id_token.ttl", (key, value) -> Common.OP_ID_TOKEN_TTL = value.asLong());
		c.watch(Security.class, "oidc.op.refresh_token.ttl", (key, value) -> Common.OP_REFRESH_TOKEN_TTL = value.asLong());
		c.watch(Security.class, "oidc.op.auth_code.ttl", (key, value) -> Common.OP_AUTH_CODE_TTL = value.asLong());
		c.watch(Security.class, "oidc.op.auth_code.max", (key, value) -> Common.OP_AUTH_CODE_MAX = value.asInt());
		c.watch(Security.class, "oidc.op.jwt.public", (key, value) ->
		{
			if( value.isEmpty() ) { return; }
			
			String k = value.asString();
			if( Files.isRegularFile(Paths.get(k)) )
				k = new String(Files.readAllBytes(Paths.get(k)));
			
			Common.OP_PUBLIC_KEY = (RSAPublicKey) KeyFactory.getInstance("RSA").generatePublic(
				new X509EncodedKeySpec(
					Base64.getDecoder().decode(
						k.replaceAll("\\n", "").replace("-----BEGIN PUBLIC KEY-----", "").replace("-----END PUBLIC KEY-----", "")))
				);
		});
		c.watch(Security.class, "oidc.op.jwt.private", (key, value) ->
		{
			if( value.isEmpty() )
			{
				// the private key lives encrypted in the vault so that it never appears in the config or snapshot in clear form
				Data stored = Manager.of(Vault.class).get("oidc.op.jwt.private");
				if( stored == null || stored.isEmpty() )
				{
					// generate a new key now
					KeyPairGenerator keyGen = KeyPairGenerator.getInstance("RSA");
		            keyGen.initialize(4096);
		            KeyPair pair = keyGen.generateKeyPair();

		            stored = Data.of(new String(Base64.getEncoder().encode(pair.getPrivate().getEncoded())));
		            Manager.of(Vault.class).set("oidc.op.jwt.private", stored);
		            Manager.of(Config.class).set(Security.class, "oidc.op.jwt.public", new String(Base64.getEncoder().encode(pair.getPublic().getEncoded())));
				}

				Common.OP_PRIVATE_KEY = KeyFactory.getInstance("RSA").generatePrivate(
					new PKCS8EncodedKeySpec(
						Base64.getDecoder().decode(
							stored.asString().replaceAll("\\n", "").replace("-----BEGIN PRIVATE KEY-----", "").replace("-----END PRIVATE KEY-----", "")))
					);
			}
			else if( Files.isRegularFile(Paths.get(value.asString())) )
			{
				// operator-provided key file, managed outside of the config and snapshot
				String k = new String(Files.readAllBytes(Paths.get(value.asString())));

				Common.OP_PRIVATE_KEY = KeyFactory.getInstance("RSA").generatePrivate(
					new PKCS8EncodedKeySpec(
						Base64.getDecoder().decode(
							k.replaceAll("\\n", "").replace("-----BEGIN PRIVATE KEY-----", "").replace("-----END PRIVATE KEY-----", "")))
					);
			}
			else
			{
				// inline key in the config: move it to the vault and wipe it from the config so that it stops
				// being included in snapshots. The key value is preserved so that issued tokens remain valid.
				Manager.of(Vault.class).set("oidc.op.jwt.private", Data.of(
					value.asString().replaceAll("\\n", "").replace("-----BEGIN PRIVATE KEY-----", "").replace("-----END PRIVATE KEY-----", "")));
				// re-triggers the watch -> the key is loaded from the vault
				Manager.of(Config.class).set(Security.class, "oidc.op.jwt.private", "");
				Manager.of(Logger.class).warning(Security.class, "The OIDC OP private key was moved from the config to the vault. "
					+ "Snapshots taken before this point still contain the key: consider rotating it.");
			}
		});
		Manager.of(Timeout.class).watch(Common.tracker);
		
		if( !c.get(Security.class, "otp.initialized").asBool() )
		{
			// restrict access to /api/meta
			Policy.Type policy = new Policy.Deny().template().create(Data.map().put("parameters", Data.map().put("scope", "http")));
			policy.name("Deny /api/meta and /api/admin to non administrators");
			policy.addRelation("rule", new Rule.And().template().create()
				.addRelation("rules", new Rule.Or().template().create()
					.addRelation("rules", new Rule.MatchContext().template().create(Data.map().put("parameters", Data.map().put("property", "path").put("value", "/api/meta/#").put("wildcard", true))))
					.addRelation("rules", new Rule.MatchContext().template().create(Data.map().put("parameters", Data.map().put("property", "path").put("value", "/api/admin/#").put("wildcard", true)))))
				.addRelation("rules", new Rule.Not().template().create().addRelation("rule", new Rule.Role().template().create(Data.map().put("parameters", Data.map().put("role", Role.SUPERADMIN.id()))))));
			
			// set and save the monitoring storage
			Storage.Type monitor = new Storage.File().template().create(Data.map().put("parameters", Data.map().put("root", Manager.of(Config.class).get(Monitor.class, "path")))).name("Monitor statistics");
			c.set(Monitor.class, "storage", Data.of(monitor.id()));
			
			// set and save the security storage
			Storage.Type securityStorage = new Storage.File().template().create(Data.map().put("parameters", Data.map().put("root", Manager.of(Config.class).get(Security.class, "path")))).name("Security storage");
			c.set(Security.class, "oidc.op.storage", Data.of(securityStorage.id()));
			c.set(Security.class, "token.storage", Data.of(securityStorage.id()));
			c.set(Security.class, "otp.initialized", Data.of(true));
			
			// set the security storage to be the same as the security storage
			c.set(Vault.class, "storage", Data.of(securityStorage.id()));
		}
		else
			initialized = true;

		aeonics.endpoint.meta.Configuration.register();
		aeonics.endpoint.meta.Endpoints.register();
		aeonics.endpoint.meta.Flows.register();
		aeonics.endpoint.meta.Plugins.register();
		aeonics.endpoint.meta.Security.register();
		aeonics.endpoint.meta.Snapshots.register();
		aeonics.endpoint.meta.Storage.register();
		aeonics.oidc.Endpoints.register();
		aeonics.oidc.op.Endpoints.register();
		aeonics.oidc.rp.Endpoints.register();
		aeonics.oidc.TOTP.register();
		
		m = new Monitoring();
		m.setup();
	}
	
	private Monitoring m;
	private boolean initialized = false;
	
	private void afterRun()
	{
		if( !initialized )
		{
			// default oidc client and rp
			RelyingParty.Type rp = new RelyingParty().template().create(Data.map().put("parameters", Data.map()
				.put("redirect_uri", Common.OP_ISSUER_URL + "/oidc/response")
				.put("trusted_auto_consent", true)))
				.addRelation("groups", Group.ADMINISTRATORS)
				.addRelation("groups", Group.USERS)
				.name(Manager.of(Config.class).get(RelyingParty.class, "name").asString())
				.<RelyingParty.Type>cast();
			OidcProvider.Type provider = new OidcProvider().template().create(Data.map().put("parameters", Data.map()
				.put("wellknown", Common.OP_ISSUER_URL + "/.well-known/openid-configuration")
				.put("client_id", rp.clientId())
				.put("client_secret", rp.clientSecret())))
				.name("Local Authentication")
				.<OidcProvider.Type>cast();
			Manager.of(Config.class).set(Security.class, "local.provider", provider.id());
		}
	}
}
