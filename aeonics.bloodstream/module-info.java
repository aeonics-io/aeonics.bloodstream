module aeonics.bloodstream
{
	requires aeonics.boot;
	requires aeonics.core;
	requires aeonics.http;
	requires java.management;
	
	provides aeonics.Plugin with local.Main;
}
