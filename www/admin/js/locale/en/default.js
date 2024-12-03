
export default {
	'ok': "OK",
	'cancel': "Cancel",
	'yes': "Yes",
	'no': "No",
	'close': "Close",
	'remove': "Remove",
	'edit': "Edit",
	'info': "Details",
	'all': "View all",
	'time': "Time",
	'time_ratio': "% CPU Time",
	'scale_network': "Network activity (MB)",
	'settings': "Settings",
	'download': "Download",
	'restore': "Restore",
	'browse': "Browse",
	'query': "Query",
	'save': "Save",
	'create': "Create",
	
	'login.welcome': "Welcome {}",
	'login.no_access': "Unfortunately you do not have access to this application. Please login with another user.",
	'login.required': "Authentication required",
	'login.login': "Login",
	'login.error.fetch': "The required information could not be fetched at this time. Please try again or contact your system administrator.",
	
	'fetch.error': "Communication with the server failed.",
	
	'menu.dashboard': "Dashboard & Metrics",
	'menu.navigate': "Overview",
	'menu.statistics': "Statistics",
	'menu.esg': "Carbon Footprint",
	'menu.security': "Security",
	'menu.operational': "Operational",
	'menu.workflow': "Workflows",
	'menu.config': "Configuration",
	'menu.endpoints': "Web Endpoints",
	'menu.storage': "Data Storage",
	'menu.access': "Access Control",
	'menu.troubleshooting': "Troubleshooting",
	'menu.debug': "Debug",
	'menu.logs': "Logs",
	'menu.metrics': "Metrics",
	'menu.snapshot': "Snapshots",
	'menu.plugins': "Plugins",
	
	'entity.edit.invalid': "Cannot edit this entity",
	'entity.edit.success': "Entity updated",
	'entity.edit.error': "Entity update failed",
	'entity.create.invalid': "Cannot create this type of entity",
	'entity.create.success': "Entity created",
	'entity.create.error': "Entity creation failed",
	'entity.template.error': "Cannot fetch entity template",
	'entity.name': "Name",
	'entity.related': "Related entity",
	'entity.related.description': "The related entity will be linked and referenced by its id.",
	'entity.relation.limit': "Maximum relations reached",
	'entity.choose.category': "Choose a category",
	'entity.name.description': "The name of the entity can be used as an identifier, but there is no check performed to determine if the name is unique or not.",
	
	'info.technical': "Identification",
	'info.template': "Entity type",
	'info.channels': "Data channels",
	'info.channel.direction': "Direction",
	'info.channel.direction.input': "input",
	'info.channel.direction.output': "output",
	'info.config': "Configuration",
	'info.relationship': "Relationships",
	'info.entity.id': "Unique ID",
	'info.entity.category': "Item category",
	'info.entity.type': "Item type",
	'info.entity.class': "Entity class",
	'info.entity.internal': "Internal entity",
	'info.template.summary': "Summary",
	'info.template.description': "Description",
	'info.template.category': "Item category",
	'info.template.type': "Item type",
	'info.template.type_plugin': "Item plugin",
	'info.template.target': "Entity class",
	'info.template.target_plugin': "Entity plugin",
	'info.template.class': "Template class",
	'info.template.template_plugin': "Template plugin",
	'info.config.empty': "There are no configuration parameters for this entity.",
	'info.config.summary': "Summary",
	'info.config.description': "Description",
	'info.config.optional': "Optional",
	'info.config.minmax': "Min/Max length",
	'info.config.default': "Default value",
	'info.config.bindable': "Bindable",
	'info.config.rule': "Has validation rule",
	'info.config.format': "Format",
	'info.config.values': "Restricted values",
	'info.config.config': "Scope",
	'info.config.global': "global: <em>{}</em>",
	'info.config.local': "local",
	'info.link.target': "Referenced by",
	'info.link.target2': "{} ({})",
	'info.link.empty': "This entity is not explicitly related to any other.",
	
	'stats.hourly': "System activity this hour",
	'stats.daily': "Average system activity today",
	'stats.yearly': "Average system activity this year",
	'stats.series.cpu': "Active",
	'stats.series.blocked': "Blocked",
	'stats.series.waiting': "Awaiting",
	'stats.fact.currentcpu': "Current CPU usage<span>{}%</span>",
	'stats.fact.hourly': "Total CPU time this hour<span>{}ms</span>",
	'stats.fact.uptime': "System uptime<span>{}:{}:{}</span>",
	'stats.fact.memoryheap': "Memory usage (heap)<span>{}MB</span>",
	'stats.fact.memorynonheap': "Memory usage (non-heap)<span>{}MB</span>",
	'stats.fact.memorycommitted': "Committed memory<span>{}MB</span>",
	'stats.fact.pending': "Tasks pending<span>{}</span>",
	'stats.fact.tasks': "Tasks executed since boot<span>{}</span>",
	'stats.fact.avgtime': "Average execution time<span>{}</span>",
	
	'esg.title.uptime': "Since last reboot",
	'esg.uptime': "System uptime",
	'esg.data_density': "Processing intensity<br />(%)",
	'esg.data_ingress': "Network ingress",
	'esg.data_egress': "Network egress",
	'esg.connected': "Established network connections",
	'esg.totalcpu': "Processor execution",
	'esg.title.hourly': "This hour",
	'esg.title.daily': "Today",
	'esg.title.monthly': "This month",
	'esg.title.yearly': "This year",
	'esg.co2e.upratio': "Uptime<br />(%)",
	'esg.co2e.total': "Total carbon footprint<br />(CO2e)",
	'esg.co2e.network': "Network footprint",
	'esg.co2e.cpu': "CPU footprint",
	'esg.co2e.machine': "Machine footprint",
	'esg.co2e.lifecycle': "Lifecycle footprint",
	'esg.settings.cpu': "CPU TDP (W)",
	'esg.settings.pue': "Datacenter PUE",
	'esg.settings.energy': "Energy carbon intensity (gCO2e/KWh)",
	'esg.settings.cores': "Physical CPU cores",
	'esg.settings.network': "Network carbon intensity (gCO2e/GB)",
	'esg.settings.idleratio': "Energy consumption when idle (%)",
	'esg.disclaimer': "<h1>Implementation methodology</h1><p>The carbon emission calculation is based on academic publications, manufacturer specifications, institutional reportings, "
		+ "independent studies, lifecycle assessments, and statistical data collection from:<ul><li>University of Technology in Sweden</li><li>Boavizta</li><li>AMD and Intel</li>"
		+ "<li>The European network of Institutes for Sustainable IT</li><li>Statista</li><li>OVH, Microsoft and Google</li><li>Dell, HP, Lenovo</li>"
		+ "<li>The French Ministère de la Transition Ecologique and ADEME</li><li>European Commission, Joint Research Centre</li></ul>"
		+ "All computations are based on production-grade server machines hosted in a datacenter. The intermediate computation hypothesis can be adjusted for other type of situations such as a standalone machine, edge device or personal computer."
		+ "<br />&nbsp;</p><hr /><p>"
		+ "The computation is based on the <em>elapsed time</em> the system has been running, the <em>CPU time</em> and the <em>network usage</em> as reported by internal probes. "
		+ "It voluntarily ommits any carbon compensation or carbon credits mechanisms which does not prevent emissions to happen in the first place.<br /><br />"
		+ "The metrics reported focus on this system instance and does not have the possibility to provide systemwide carbon footprint from other processes or virtual machines. "
		+ "Remote end user devices, input data sources, sensors, and third party servers are also omitted from the computation. "
		+ "Multiple instances of the system running on the same machine may account multiple times from the same carbon emissions, this is a tradeoff towards a responsible carbon-aware reporting "
		+ "that does not attempt to diminish or hide any part of the system carbon footprint. Some but not all Scope 1, Scope 2 and Scope 3 emissions are accounted for in the computation to the best extent."
		+ "<br />&nbsp;</p><hr /><p>"
		+ "The goal is to provide clear comparable metrics across different instances of the system and to report trends and feedback on actions taken to "
		+ "improve the system carbon footprint. The numbers do not reflect true accurate absolute numbers and do not report other metrics and sources of "
		+ "impacts such as water consumption, acidification of soils or plenetary resources exhaustion.<br /><br />"
		+ "Numbers and figures presented on this page may be considered as KPIs for <em>ESG</em> and suitable for <em>CSRD</em> reporting.</p>",
	
	'security.integrity': "Software Bill of Materials",
	'security.integrity.explain': "This section includes details such as the binary size, modification date, and hash value "
		+ "to ensure that the original file has not been tampered with. Additionally, it lists the internal code packages and their interactions "
		+ "with other components. Regularly reviewing this information is crucial, and applying the principles of least privilege and least exposure "
		+ "helps minimize security risks. Given that the system itself may not always be fully trusted, it is essential to continuously monitor these "
		+ "metrics and compare them against the reference architecture. This proactive approach enables you to quickly identify any deviations from "
		+ "the intended configuration and detect unauthorized modifications that may occur unnoticed in the live environment.",
	'security.file.name': "File name",
	'security.file.modified': "Last modified",
	'security.file.size': "Size in bytes",
	'security.file.hash': "File hash",
	'security.module.packages': "Packages",
	'security.module.uses': "Uses",
	'security.module.provides': "Provides",
	'security.module.requires': "Requires",
	'security.module.opens': "Opens",
	'security.module.exports': "Exports",
	'security.surface': "Attack surface rating",
	'security.surface.plugins': "Plugins",
	'security.surface.plugins.title': "Number of plugins",
	'security.surface.plugins.explain': "Minimizing the number of plugins, code libraries, and dependencies in an application server is critical "
		+ "for reducing the attack surface, directly enhancing cybersecurity posture. Each additional plugin or dependency introduces potential "
		+ "vulnerabilities that could be exploited by attackers.<br /><br />Limiting plugins and dependencies also mitigates the risk of supply "
		+ "chain attacks, which not only impact security but also affect the availability and maintainability of the application, as excessive " 
		+ "dependencies can complicate updates, patches, and compatibility management. Tracking and managing these dependencies is crucial for "
		+ "compliance with <em>NIS2</em> and <em>SOC2</em>.",
	'security.surface.packages': "Packages",
	'security.surface.packages.title': "Number of code packages",
	'security.surface.packages.explain': "Minimizing the number of code packages is essential for maintaining a cohesive and manageable codebase. "
		+ "This metric specifically highlights the scatteredness of the code. A higher number of packages often indicates fragmented code, making "
		+ "it more challenging to maintain and complicates the identification of key components.<br /><br />A large number of packages implies "
		+ "that deep, comprehensive knowledge of the entire codebase becomes harder to achieve, leading to potential gaps in understanding and "
		+ "increasing the risk of errors or oversight. Keeping the number of packages low facilitates more straightforward code reviews, debugging, "
		+ "and testing processes, which are crucial for ensuring code quality and stability in the scope of <em>ISO 27001</em> and the <em>OWASP SAMM</em> "
		+ "(Software Assurance Maturity Model).",
	'security.surface.code': "Code",
	'security.surface.code.title': "Total code size (MB)",
	'security.surface.code.explain': "Minimizing the size of the codebase is crucial for managing code complexity and maintaining high-quality standards. "
		+ "This metric provides additional insights into the overall quantity of code that must be managed, reviewed, and maintained. A smaller codebase "
		+ "simplifies maintenance tasks, reduces the likelihood of errors, and makes it easier to implement updates and security patches.<br /><br />"
		+ "The runtime code size directly contributes to reducing the attack surface, as there are fewer opportunities for vulnerabilities to be "
		+ "introduced. It also provide strong evidence that the code is more optimized and well-engineered, leading to better performance and resource efficiency. "
		+ "As such, it supports compliance with <em>CIS Controls</em>, and <em>NIST SP 800-53</em> standards.",
	'security.surface.entities': "Entities",
	'security.surface.entities.title': "Number of registered entities",
	'security.surface.entities.explain': "The runtime number of entities (operational class instances) is a dynamic metric that provides critical insights into the actual behavior of the system, "
		+ "this metric reflects the true operational footprint of the application. Keeping the number of entities at an acceptable level is important for memory "
		+ "optimization, performance, and stability of the system.<br /><br />The number of entities naturally depends on the specific business processes, scope and "
		+ "depth of the implementation. Keeping this number low is important because it implies a smaller attack surface, as fewer active components are at risk of "
		+ "exploitation during runtime. A lower number of entities usually imply limited exposure, improved resiliency, and reduced threat propagation which is important "
		+ "in the scope of <em>NIST SP 800-207</em> or when approaching <em>ZTA</em> (Zero Trust Architecture).",
	
	'config.title': "Systemwide Configuration",
	'config.snapshot.explain': "Systemwide configuration parameters are not specific to a particular entity instance. They apply globally "
		+ "and all modules may react to changes in real time. "
		+ "<br />However, changes <em>will not be persisted</em> after reboot unless you perform a system snapshot.",
	'config.undocumented': "Undocumented",
	'config.undocumented.explain': "Undocumented configuration parameters are usually imported from command line or environment parameters. "
		+ "You may change or remove the value but it may not produce any effect.",
	'config.remove.confirm': "Are you sure you want to completely remove parameter <em>{}</em> ?",
	'config.remove.ok': "Parameter removed",
	'config.remove.error': "Could not remove parameter",
	'config.edit.ok': "Parameter modified",
	'config.edit.error': "Could not modify parameter",
	'config.info.none': "No definition for this parameter",
	
	'endpoints.title': "Web Endpoints",
	'endpoints.explain': "Web endpoints are for the most part REST APIs that return a JSON output. They can be used to contol the system dynamically at "
		+ "runtime. Custom endpoints can be deployed to deliver the business logic for frontent applications or system-to-system communications.",
	'endpoints.no_summary': "The summary is not available.",
	'endpoints.no_description': "The detailed description is not available.",
	'endpoints.test': "Test this endpoint",
	'endpoints.no_parameters': "No parameters",
	'endpoints.no_returns': "The return value description is not available.",
	'endpoints.empty': "No endpoint to display.",
	'endpoints.description': "Description",
	'endpoints.parameters': "Parameters",
	'endpoints.returns': "Return value",
	'endpoints.summary': "Summary",
	'endpoints.fail.template': "Description not available",
	'endpoints.fail.endpoint': "Endpoint definition not available",
	'endpoints.test': "Call this endpoint",
	'endpoints.update': "Update endpoint",
	'endpoints.remove': "Remove endpoint",
	'endpoints.test.current_user': "Current user",
	'endpoints.test.anonymous': "Anonymous",
	'endpoints.test.token': "User token",
	'endpoints.test.auth': "Authentication",
	'endpoints.run': "Run",
	'endpoints.result.status': "Response code",
	'endpoints.result.roundtrip': "Roundtrip time",
	'endpoints.result.processing': "Server processing time",
	'endpoints.wizard': "Wizard",
	'endpoints.wizard.title': "Endpoint details",
	'endpoints.wizard.url': "/path/to/endpoint",
	'endpoints.wizard.returns': "Return value",
	'endpoints.wizard.summary': "Summary",
	'endpoints.wizard.description': "Description",
	'endpoints.wizard.deploy': "Deploy",
	'endpoints.wizard.wait': "Publishing...",
	'endpoints.wizard.success': "Endpoint published",
	'endpoints.wizard.fail': "Publication failed",
	'endpoints.wizard.fail2': "Error on line <em>{}</em>:<br />{}",
	'endpoints.upload': "Upload",
	'endpoints.remove.confirm': "Are you sure you want to remove the endpoint:<br /><em>{} {}</em>",
	'endpoints.remove.ok': "Endpoint removed",
	'endpoints.remove.error': "Could not remove endpoint",
	
	'snapshot.title': "System Snapshots",
	'snapshot.explain': "The system uses direct in-memory configuration and in-memory registry which implies that modifications in those "
		+ "are <em>not persisted across a system restart</em>. In order to persist the configuration, the registry or other module-specific "
		+ "state, you can perform a system snapshot. Note that internal components, managers and factories are not affected by snapshots.<br />"
		+ "Snapshots can also be restored on another system to facilitate releases and deployment of new environments.",
	'snapshot.current': "Current snapshot manager",
	'snapshot.latest': "Latest snapshot",
	'snapshot.list': "Available snapshots",
	'snapshot.empty': "There are no snapshots available",
	'snapshot.create': "Create",
	'snapshot.name.prompt': "Display name of the snapshot:<br />(max 30 characters, no special characters)",
	'snapshot.create.success': "Snapshot created",
	'snapshot.create.error': "Could not create snapshot",
	'snapshot.info.name': "Full name",
	'snapshot.info.date': "Creation date",
	'snapshot.info.actions': "Actions",
	'snapshot.remove.confirm': "Please confirm that you want to permanently remove snapshot <em>{}</em>",
	'snapshot.restore.confirm': "Please confirm that you want to restore snapshot <em>{}</em><br />Note that the latest snapshot will always have precedence "
		+ "in case of system restart.<br />After the restore operation is complete, you may have to login again.",
	'snapshot.remove.success': "Snapshot removed",
	'snapshot.remove.error': "Could not remove snapshot",
	'snapshot.restore.success': "Snapshot restored",
	'snapshot.restore.error': "Could not restore snapshot",
	'snapshot.download.error': "Could not download snapshot",
	'snapshot.upload': "Upload",
	'snapshot.upload.success': "Snapshot uploaded",
	'snapshot.upload.error': "Could not upload snapshot",
	
	'storage.title': "Storage Locations",
	'storage.explain': "In order to increase independence of components and entities, the Storage entity can be used to persist some content "
		+ "using a typical directory structure. The storage persistency may be temporary or long-lived, local or remote, file-based or any "
		+ "other implementation.<br />"
		+ "Similarly, the Database entity represents a connection to a database and eases the query operations to deal with built-in data structures.",
	'storage.storage': "Storage",
	'storage.database': "Database",
	'storage.remove.storage.confirm': "Please confirm that you want to permanently remove storage <em>{}</em>",
	'storage.remove.storage.success': "Storage removed",
	'storage.remove.storage.error': "Could not remove storage",
	'storage.remove.database.confirm': "Please confirm that you want to permanently remove database <em>{}</em>",
	'storage.remove.database.success': "Database removed",
	'storage.remove.database.error': "Could not remove database",
	'storage.query': "SQL query to perform",
	'storage.browse.error': "Failed to get storage content",
	'storage.remove.item.confirm': "Please confirm that you want to remove <em>{}</em>",
	'storage.remove.item.success': "Item removed",
	'storage.remove.item.error': "Could not remove item",
	'storage.download.item.error': "Could not download file",
	'storage.upload.item.success': "Upload complete",
	'storage.upload.item.error': "Upload failed",
	
	'plugins.title': "Plugins",
	'plugins.explain': "Plugins are precompiled modules that package a set of functionnality and entities together. When the system starts, it loads "
		+ "all plugins automatically. Since plugins may have many side effects, a system reboot is required when you add, update, or remove a plugin.",
	'plugins.action.deploy': "Deploy",
	'plugins.action.undeploy': "Undeploy",
	'plugins.action.reboot': "Reboot",
	'plugins.remove.confirm': "Please confirm that you want to remove the <em>{}</em> plugin",
	'plugins.remove.success': "Plugin removed",
	'plugins.remove.error': "Could not remove plugin",
	'plugins.reboot_required': "In order to cleanup resources and account for changes, a system reboot is required.<br />Do you want to reboot now ?",
	'plugins.reboot_later': "Later",
	'plugins.reboot.confirm': "Please confirm that you want to reboot the system."
		+ "<br />This will create a <em>short unavailability</em> and you may have to login again."
		+ "<br />The <em>latest snapshot</em> will be loaded on startup.",
	'plugins.deploy.success': "Plugin deployed",
	'plugins.deploy.error': "Could not deploy plugin",
	'plugins.reboot_pending': "The system is restarting, please wait while we try to get it back...",
	
	'logs.title': "Live logs",
	'logs.explain': "Connect to the live data stream of system logs. Using data workflows, you can subscribe to the <em>log</em> topic and fetch the messages "
		+ "in real time. This enables live troubleshooting and monitoring of events.",
	'logs.start': "Start",
	'logs.suspend': "Suspend",
	'logs.stop': "Stop",
	'logs.restore.level': "Restore log level",
	'logs.restore.success': "Log level restored",
	'logs.restore.fail': "Could not restore log level",
	'logs.choose.level': "Desired log level",
	'logs.choose.filter': "Filter by tag",
	'logs.ws.disconnect': "Live logging disconnected",
	'logs.ws.success': "Live logging enabled",
	'logs.set.error': "Could not enable logging",
	'logs.suspended': "Live logging suspended",
	'logs.status': "Current state: ",
	'logs.status.connected': "Connected",
	'logs.status.disconnected': "Disconnected",
	
	'debug.title': "Live debugging",
	'debug.explain': "Debug information come from the underlying source code of entities. You can output any message or variables to the <em>Debug.debug()</em> "
		+ "method and the output will be treated as a data stream. You can then subscribe to the <em>debug</em> topic and " 
		+ "fetch the messages in real time. This enables live troubleshooting and eases debugging of internal entity state at runtime.",
	'debug.start': "Start",
	'debug.stop': "Stop",
	'debug.choose.filter': "Filter by tag",
	'debug.ws.disconnect': "Live debug disconnected",
	'debug.ws.success': "Live debug enabled",
	'debug.status': "Current state: ",
	'debug.status.connected': "Connected",
	'debug.status.disconnected': "Disconnected",
	
	'metrics.title': "Live internal metrics",
	'metrics.explain': "Metrics come from the underlying entities and managers. The reported information contain the number of occurences and an aggregated sum "
		+ "over a configurable time window. Depending on the metric, the meaning of the data may vary. Since the amount of monitoring data can grow large, "
		+ "this page shows a simple high level summary of the data. Consider using a specialized monitoring dashboard for more analysis capabilities.",
	'metrics.start': "Start",
	'metrics.stop': "Stop",
	'metrics.ws.disconnect': "Live metrics disconnected",
	'metrics.ws.success': "Live metrics enabled",
	'metrics.status': "Current state: ",
	'metrics.status.connected': "Connected",
	'metrics.status.disconnected': "Disconnected",
	'metrics.time': "Next data collection in ",
	'metrics.time.left': "{}s",
	'metrics.nodata': "There are no metrics data at this time. If you just started the system or the monitoring, this is normal.",
	'metrics.table.category': "Category",
	'metrics.table.type': "Item Type",
	'metrics.table.id': "Entity",
	'metrics.table.metric': "Units",
	'metrics.keep_active': "Do you want to stop collecting metrics in the background to spare system resources ?",
	'metrics.keep_active.success': "Metrics disabled",
	'metrics.keep_active.error': "Could not disable metrics",
	
	'access.title': "Security targets",
	'access.explain': "The security targets define individuals or organisational roles for <em>authentication</em>. It defines <em>who</em> is performing "
		+ "an operation.",
	'access.tab.users': "Users",
	'access.tab.groups': "Groups",
	'access.tab.roles': "Roles",
	'access.title2': "Security policies",
	'access.explain2': "The security policies define the rules for <em>authorization</em> to grant or deny access. It defines <em>which</em> operation can "
		+ "be performed. The final decision process is a combination of all applicable policies, at least one grant must be given and no deny.",
	'access.tab.providers': "Providers",
	'access.policy.scope': "Applicable scope",
	
	'me.logout': "Logout",
	'me.info': "User information",
	'me.info.login': "Login",
	'me.info.name': "Name",
	'me.info.id': "Entity",
	'me.info.valid': "Valid user",
	'me.info.roles': "Roles",
	'me.info.groups': "Groups",
	'me.info.mfa': "Has multifactor",
	
	'workflow.title': "Data Flows",
	'workflow.explain': "Data flows encapsulate the interconnected elements of data pipelines. It offers a focused view on a particular business process. "
		+ "A data flow usually starts with an <em>origin</em> entity that publishes data on a <em>topic</em> entity. Then, a <em>queue</em> subscribes to "
		+ "relevant data and chains a series of <em>action</em> entities until a final <em>destination</em> entity."
		+ "<br /><br />Note that entities may exist and be active outside of any flow if they were not assigned to a particular data flow.",
	'workflow.empty': "There are no flows at this time...",
	'workflow.create.name': "Data flow name",
	'workflow.create.error': "Could not create data flow",
	'workflow.remove.confirm': "Please confirm that you want to remove data flow <em>{}</em> and all its content.",
	'workflow.remove.success': "Data flow removed",
	'workflow.remove.error': "Could not remove data flow",
	'workflow.flow.edit': "Update data flow",
	'workflow.flow.success': "Data flow updated",
	'workflow.flow.error': "Could not update data flow",
	'workflow.flow.name': "Name...",
	'workflow.flow.description': "Description...",
	'workflow.save.error': "Could not save data flow",
	'workflow.origin': "Origin",
	'workflow.topic': "Topic",
	'workflow.queue': "Queue",
	'workflow.action': "Action",
	'workflow.destination': "Destination",
	
	'': ""
};
