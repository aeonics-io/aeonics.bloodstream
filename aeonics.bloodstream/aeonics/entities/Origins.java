package aeonics.entities;

public class Origins 
{
	private Origins() { /* no instances */ }
	
	public static void register()
	{
		// calling this method will force initialization of all private static members
		// all endpoints will be added to the registry automatically
	}
}
