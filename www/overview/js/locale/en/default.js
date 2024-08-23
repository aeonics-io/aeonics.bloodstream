
export default {
	'ok': "OK",
	'cancel': "Cancel",
	'yes': "Yes",
	'no': "No",
	'close': "Close",
	'edit': "Edit",
	'info': "Details",
	'all': "View all",
	'time': "Time",
	'time_ratio': "% CPU Time",
	'scale_network': "Network activity (MB)",
	'settings': "Settings",
	
	'login.welcome': "Welcome {}",
	'login.no_access': "Unfortunately you do not have access to this application. Please login with another user.",
	'login.required': "Authentication required",
	'login.login': "Login",
	'login.error.fetch': "The required information could not be fetched at this time. Please try again or contact your system administrator.",
	
	'fetch.error': "Communication with the server failed.",
	
	'menu.navigate': "Overview",
	'menu.statistics': "Statistics",
	'menu.esg': "Carbon footprint",
	'menu.security': "Security",
	
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
	'stats.fact.memorycommitted': "Memory usage (process size)<span>{}MB</span>",
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
	
	'security.integrity': "Plugin integrity",
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
	
	'': ""
};
