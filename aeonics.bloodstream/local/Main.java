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
import aeonics.entity.Action;
import aeonics.entity.Registry;
import aeonics.entity.Storage;
import aeonics.entity.security.Policy;
import aeonics.entity.security.Rule;
import aeonics.entity.security.User;
import aeonics.http.Router;
import aeonics.manager.Config;
import aeonics.manager.Lifecycle;
import aeonics.manager.Lifecycle.Phase;
import aeonics.manager.Manager;
import aeonics.manager.Security;
import aeonics.manager.Timeout;
import aeonics.oidc.Common;
import aeonics.oidc.op.OidcProvider;
import aeonics.oidc.rp.RelyingParty;
import aeonics.template.Factory;
import aeonics.template.Parameter;
import aeonics.util.Callback;

public class Main extends Plugin
{
	public String summary() { return "Observability v0.1"; }
	public String description() { return "Provides the system internal observability capabilities via REST endpoints."; }
	
	public void start()
	{
		Manager.of(Lifecycle.class).on(Phase.LOAD, Callback.once(() -> onLoad()));
		Manager.of(Lifecycle.class).on(Phase.CONFIG, Callback.once(() -> onConfig()));
		Manager.of(Lifecycle.class).on(Phase.RUN, Callback.once(() -> onRun()));
		Manager.of(Lifecycle.class).after(Phase.RUN, Callback.once(() -> afterRun()));
	}
	
	private static void onLoad()
	{
		Factory.add(new OidcProvider());
		Factory.add(new RelyingParty());
	}
	
	private static void onConfig()
	{
		Config c = Manager.of(Config.class);
		
		// ===========================
		// TOPT stuff
		
		c.declare(Security.class, new Parameter("otp.period")
			.summary("OTP time window")
			.description("The OTP time window in seconds.")
			.rule(Parameter.DIGIT)
			.defaultValue(Data.of(30)));
		c.declare(Security.class, new Parameter("otp.digits")
			.summary("OTP number of digits")
			.description("The number of OTP code digits.")
			.rule(Parameter.DIGIT)
			.defaultValue(Data.of(6)));
		c.declare(Security.class, new Parameter("otp.algorithm")
			.summary("OTP algorithm")
			.description("The name of the hash algorithm to use in OTP.")
			.defaultValue(Data.of("SHA1")));
		c.declare(Security.class, new Parameter("otp.issuer")
			.summary("OTP issuer name")
			.description("The name of the OTP issuer to be displayed by MFA apps.")
			.defaultValue(Data.of("Aeonics Bloodstream Enterprise Suite")));
		
		// ===========================
		// OP stuff
		
		c.declare(Security.class, new Parameter("oidc.op.issuer")
			.summary("OIDC OP issuer url")
			.description("The url of this OIDC OP instance.")
			.rule(Parameter.URL)
			.defaultValue(Data.of("https://localhost")));
		c.declare(Security.class, new Parameter("oidc.op.access_token.ttl")
			.summary("OIDC OP access token validity")
			.description("The validity period in seconds for access tokens issued by this OIDC OP.")
			.rule(Parameter.DIGIT)
			.defaultValue(Data.of(86400)));
		c.declare(Security.class, new Parameter("oidc.op.id_token.ttl")
			.summary("OIDC OP id token validity")
			.description("The validity period in seconds for id tokens issued by this OIDC OP.")
			.rule(Parameter.DIGIT)
			.defaultValue(Data.of(300)));
		c.declare(Security.class, new Parameter("oidc.op.refresh_token.ttl")
			.summary("OIDC OP refresh token validity")
			.description("The validity period in seconds for refresh tokens issued by this OIDC OP.")
			.rule(Parameter.DIGIT)
			.defaultValue(Data.of(2592000)));
		c.declare(Security.class, new Parameter("oidc.op.auth_code.ttl")
			.summary("OIDC OP authentication code validity")
			.description("The validity period in seconds for the authentication code in this OIDC OP. This means that the user must complete authentication within this time window.")
			.rule(Parameter.DIGIT)
			.defaultValue(Data.of(180)));
		c.declare(Security.class, new Parameter("oidc.op.auth_code.max")
			.summary("OIDC OP maximum concurrent authentication flows")
			.description("The maximum number of concurrent authentication flows in this OIDC OP. This limit is set to avoid spam.")
			.rule(Parameter.DIGIT)
			.defaultValue(Data.of(5000)));
		c.declare(Security.class, new Parameter("oidc.op.jwt.public")
			.summary("OIDC OP JWT public key")
			.description("The public key used by this OIDC OP to verify the JWT signature. The key should be provided in PEM-encoded base64 format. It may be the path to a local file.")
			.defaultValue(Data.empty()));
		c.declare(Security.class, new Parameter("oidc.op.jwt.private")
			.summary("OIDC OP JWT private key")
			.description("The private key used by this OIDC OP to sign the JWT. The key should be provided in PEM-encoded base64 format. It may be the path to a local file.")
			.defaultValue(Data.empty()));
		c.declare(Security.class, new Parameter("oidc.op.storage")
			.summary("OIDC OP storage")
			.description("The name or id of the storage for this OIDC OP. If the storage does not exist, a local temporary (ouf-of-storage) location is used instead.")
			.defaultValue(Data.empty()));
	}
	
	private static void onRun()
	{
		// bind the config
		Config c = Manager.of(Config.class);
		c.watch(Security.class, "oidc.op.issuer", (key, value) -> { Common.OP_ISSUER_URL = value.asString(); });
		c.watch(Security.class, "oidc.op.access_token.ttl", (key, value) -> { Common.OP_ACCESS_TOKEN_TTL = value.asLong(); });
		c.watch(Security.class, "oidc.op.id_token.ttl", (key, value) -> { Common.OP_ID_TOKEN_TTL = value.asLong(); });
		c.watch(Security.class, "oidc.op.refresh_token.ttl", (key, value) -> { Common.OP_REFRESH_TOKEN_TTL = value.asLong(); });
		c.watch(Security.class, "oidc.op.auth_code.ttl", (key, value) -> { Common.OP_AUTH_CODE_TTL = value.asLong(); });
		c.watch(Security.class, "oidc.op.auth_code.max", (key, value) -> { Common.OP_AUTH_CODE_MAX = value.asInt(); });
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
				// generate a new key now
				KeyPairGenerator keyGen = KeyPairGenerator.getInstance("RSA");
	            keyGen.initialize(4096);
	            KeyPair pair = keyGen.generateKeyPair();
	            
	            // set the config -> re-trigger the watch
	            Manager.of(Config.class).set(Security.class, "oidc.op.jwt.public", Data.of(new String(Base64.getEncoder().encode(pair.getPublic().getEncoded()))));
	            Manager.of(Config.class).set(Security.class, "oidc.op.jwt.private", Data.of(new String(Base64.getEncoder().encode(pair.getPrivate().getEncoded()))));
			}
			else
			{
				String k = value.asString();
				if( Files.isRegularFile(Paths.get(k)) )
					k = new String(Files.readAllBytes(Paths.get(k)));

				Common.OP_PRIVATE_KEY = KeyFactory.getInstance("RSA").generatePrivate(
					new PKCS8EncodedKeySpec(
						Base64.getDecoder().decode(
							k.replaceAll("\\n", "").replace("-----BEGIN PRIVATE KEY-----", "").replace("-----END PRIVATE KEY-----", "")))
					);
			}
		});
		c.watch(Security.class, "oidc.op.storage", (key, value) -> { Common.storage = Registry.of(Storage.class).get(value.asString()); });
		Manager.of(Timeout.class).watch(Common.tracker);
		
		// first restrict access
		Policy.Type policy = new Policy.Deny().template().build(Data.map().put("scope", "http"));
		policy.name("Deny /api/meta to non administrators");
		policy.addRelation("rule", new Rule.And().template().build()
			.addRelation("rules", new Rule.MatchContext().template().build(Data.map().put("property", "path").put("value", "/api/meta/#").put("wildcard", true)))
			.addRelation("rules", new Rule.Not().template().build().addRelation("rule", new Rule.Role().template().build(Data.map().put("role", "Administrator")))));
		
		// then register endpoints
		Action.Type router = Registry.of(Action.class).get(Manager.of(Config.class).get(Router.class, "default").asString());
		
		aeonics.endpoint.meta.Endpoints.register(router);
		aeonics.oidc.Endpoints.register(router);
		aeonics.oidc.op.Endpoints.register(router);
		aeonics.oidc.rp.Endpoints.register(router);
		aeonics.oidc.TOTP.register(router);
	}
	
	private static void afterRun()
	{
		// default oidc client and rp
		RelyingParty.Type rp = new RelyingParty().template().build(Data.map()
			.put("__internal", true)
			.put("redirect_uri", Common.OP_ISSUER_URL + "/oidc/response"))
			.addRelation("groups", "Administrators")
			.name("Local Provider")
			.<RelyingParty.Type>cast();
		OidcProvider.Type provider = new OidcProvider().template().build(Data.map()
			.put("__internal", true)
			.put("wellknown", Common.OP_ISSUER_URL + "/.well-known/openid-configuration")
			.put("client_id", rp.clientId())
			.put("client_secret", rp.clientSecret()))
			.name("Local Authentication")
			.<OidcProvider.Type>cast();
		provider.join(Data.map()
			.put("iss", provider.issuer())
			.put("sub", "admin")
			.put("aud", provider.id())
			.put("exp", System.currentTimeMillis()/1000 + 3600),
			Registry.of(User.class).get("admin"));
		Manager.of(Config.class).set(Security.class, "local.provider", Data.of(provider.id()));
	}
}
