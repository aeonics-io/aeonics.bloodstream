package aeonics.entities;

import aeonics.data.Data;
import aeonics.entity.Entity;
import aeonics.entity.security.User;
import aeonics.template.Item;

public abstract class MultifactorAuthentication extends Item<MultifactorAuthentication.Type>
{
	// =========================================
	//
	// BASE MFA
	//
	// =========================================
	
	/**
	 * This base entity defines the minimum requirements for MFA providers.
	 */
	public abstract static class Type extends Entity
	{
		/**
		 * Enroll a user with this MultifactorAuthentication provider.
		 * @param user the user to enroll
		 * @param context any implementation specific data
		 * @return any implementation specific data
		 * @throws RuntimeException unchecked exception in case of constraint violation or any other failure
		 */
		public abstract Data enroll(User.Type user, Data context);
		
		/**
		 * Checks if the specified user is enrolled with this MultifactorAuthentication provider.
		 * @param user the user
		 * @return true if the user is enrolled
		 */
		public abstract boolean enrolled(User.Type user);
		
		/**
		 * Perform the MFA check.
		 * @param user the target user
		 * @param context any implementation specific data
		 * @return true if the multifactor authentication check succeeds, false otherwise
		 */
		public abstract boolean check(User.Type user, Data context);
		
		/**
		 * Forgets about a user. This operation is the opposite of {@link #enroll(aeonics.entity.security.User.Type, Data)}.
		 * @param user the user to forget
		 */
		public abstract void forget(User.Type user);
	}
	
	protected Class<? extends MultifactorAuthentication> category() { return MultifactorAuthentication.class; }
	
	// =========================================
	//
	// TOTP
	//
	// =========================================
	
	// =========================================
	//
	// WebAuthN
	//
	// =========================================
}
