package aeonics.oidc.rp;

import java.util.function.Supplier;

import aeonics.data.Data;
import aeonics.entity.Entity;
import aeonics.entity.Registry;
import aeonics.entity.security.Group;
import aeonics.entity.security.Role;
import aeonics.entity.security.User;
import aeonics.manager.Manager;
import aeonics.manager.Security;
import aeonics.template.Item;
import aeonics.template.Parameter;
import aeonics.template.Relationship;
import aeonics.template.Template;
import aeonics.util.Tuple;

public class RelyingParty extends Item<RelyingParty.Type>
{
	public static class Type extends Entity
	{
		public String redirectUri() { return valueOf("redirect_uri").asString(); }
		public String clientId() { return id(); }
		public User.Type user() { for( Tuple<Entity, Data> t : relations("user") ) return ((User.Type)t.a); return null; }
		
		private String secret = null;
		public String clientSecret() { return secret; }
		
		public boolean allowPasswordGrant() { return valueOf("allow_password_grant").asBool(); }
		public boolean allowClientCredentialsGrant() { return valueOf("allow_client_credentials_grant").asBool(); }
		
		public boolean hasScope(String scope)
		{
			for( Tuple<Entity, Data> role : relations("scopes") )
				if( role.a.id().equals(scope) || role.a.name().equals(scope) )
					return true;
			return false;
		}

		@Override
		public Data export()
		{
			return super.export()
				.put("__secret", clientSecret());
		}
	}
	
	protected Class<? extends Type> defaultTarget() { return RelyingParty.Type.class; }
	protected Supplier<? extends Type> defaultCreator() { return RelyingParty.Type::new; }
	protected Class<? extends Item<? super Type>> category() { return RelyingParty.class; }

	@Override
	public Template<? extends RelyingParty.Type> template()
	{
		return super.template()
			.summary("OpenID Connect Relying Party")
			.description("Authorize a third party to use OpenID Connect or OAuth2 to authenticate users and obtain user tokens. When requesting a token using the Client Credentials Grant flow, the client will be mapped to an existing user. "
					+ "The Cliend ID is the ID of this item. All OpenID endpoint information can be found at /.well-known/openid-configuration")
			.add(new Parameter("redirect_uri")
				.summary("Redirect URI")
				.description("The redirection URL to send the Authorization Code."))
			.add(new Parameter("allow_password_grant")
				.summary("Allow Password Grant")
				.description("Allow this client to use the OAuth2 Password Grant flow.")
				.defaultValue(Data.of(false)))
			.add(new Parameter("allow_client_credentials_grant")
				.summary("Allow Client Credentials Grant")
				.description("Allow this client to use the OAuth2 Client Credentials Grant flow and authenticate as an app.")
				.defaultValue(Data.of(false)))
			.add(new Relationship("user")
				.category(User.class)
				.summary("App User")
				.description("The technical application user this client will map to when using the Client Credentials Grant flow")
				.max(1))
			.add(new Relationship("scopes")
				.category(Role.class)
				.summary("Scope")
				.description("The list of security roles to enable as scopes for this client"))
			.add(new Relationship("groups")
				.category(Group.class)
				.summary("Group")
				.description("The list of security user groups allowed to use this client. If a user is not member of one of these groups, then login will be denied."))
			.builder((data, instance) -> 
			{
				if( instance instanceof RelyingParty.Type )
				{
					if( data.containsKey("__secret") ) ((RelyingParty.Type)instance).secret = data.asString("__secret");
					else ((RelyingParty.Type)instance).secret = Manager.of(Security.class).randomHash();
				}
				Registry.add(instance);
			});
	}
}
