
let ae = globalThis.ae;
var x = new Promise((ok, nok) =>
{
	ae.require('Page', 'Node', 'Ajax', 'Translator', 'Notify', 'page.esg.css').then(([Page, Node, Ajax, Translator, Notify]) =>
	{
		var page = new Page();
		Object.assign(page, 
		{
			show: function()
			{
				this.dom.classList.add('esg');
				
				this.init();
				return Promise.resolve();
			},
			
			hide: function()
			{
				while(this.dom.firstChild) this.dom.firstChild.remove();
				return Promise.resolve(); 
			},
			
			init: function()
			{
				var self = this;
				this.dom.classList.add('wait');
				
				this.dom.append(
					Node.aside({className: 'settings', click: function(e) { document.getElementById('esg_assumptions').classList.add('open'); }, title: Translator.get('settings')}, 'settings'),
					Node.div({id: 'esg_assumptions'}, [
						Node.aside({click: function(e) { this.parentNode.classList.remove('open'); }, title: Translator.get('close')}, 'close'),
						Node.label(Translator.get('esg.settings.cpu')),
						Node.input({type: 'number', id: 'esg_i_tdp', min: 1, max: 1000, step: 1, value: 80, change: function() { self.refresh(); }}),
						Node.label(Translator.get('esg.settings.pue')),
						Node.input({type: 'number', id: 'esg_i_pue', min: 1, max: 10, step: 0.01, value: 1.58, change: function() { self.refresh(); }}),
						Node.label(Translator.get('esg.settings.energy')),
						Node.input({type: 'number', id: 'esg_i_eci', min: 1, max: 10000, step: 1, value: 300, change: function() { self.refresh(); }}),
						Node.label(Translator.get('esg.settings.cores')),
						Node.input({type: 'number', id: 'esg_i_pcpu', min: 1, max: 256, step: 1, value: 0, change: function() { self.refresh(); }}),
						Node.label(Translator.get('esg.settings.network')),
						Node.input({type: 'number', id: 'esg_i_net', min: 1, max: 256, step: 0.01, value: 9.27, change: function() { self.refresh(); }}),
						Node.label(Translator.get('esg.settings.cpuratio')),
						Node.input({type: 'number', id: 'esg_i_cpur', min: 1, max: 100, step: 1, value: 32, change: function() { self.refresh(); }}),
						Node.label(Translator.get('esg.settings.lifecycleratio')),
						Node.input({type: 'number', id: 'esg_i_lr', min: 1, max: 100, step: 1, value: 17, change: function() { self.refresh(); }})
					]),
					Node.div({className: 'block'}, [
						Node.h2(Translator.get('esg.title.uptime')),
						Node.div({id: 'esg_uptime'})
					]),
					Node.div({className: 'block'}, [
						Node.h2(Translator.get('esg.title.hourly')),
						Node.div({id: 'esg_hourly'})
					])
				);
				
				Ajax.get('/api/meta/probe').then((result) =>
				{
					self.data = result.response;
					
					var esg_i_pcpu = document.getElementById('esg_i_pcpu');
					if( parseInt(esg_i_pcpu.value) == 0 ) esg_i_pcpu.value = Math.floor(self.data.hardware.cpu.cores / 2);
					
					self.dom.classList.remove('wait');
					self.refresh();
				}, (error) =>
				{
					Notify.error(Translator.get('fetch.error'));
				});
			},
			
			refresh: function()
			{
				this.refreshUptime();
				this.refreshHourly();
			},
			
			refreshUptime: function()
			{
				var self = this;
				var div = document.getElementById('esg_uptime');
				while( div.firstChild ) div.firstChild.remove();
				
				Ajax.get('/api/meta/system').then((result) =>
				{
					var uptime = (result.response.system.time - result.response.system.boot) * 1000000;
					
					var net = parseFloat(document.getElementById('esg_i_net').value);
					var rco2e = self.data.network.read / (1024*1024*1024) * net;
					var wco2e = self.data.network.write / (1024*1024*1024) * net;
					var cco2e = Object.values(self.data.usage).reduce((a, c) => a + c.cpu_time, 0);
					const [ratio, min_gco2e, cpu_gco2e, max_gco2e] = self.computeCO2e(uptime, cco2e);
					
					div.append(
						Node.div({className: 'card'}, [
							Node.p(Translator.get('esg.uptime')),
							Node.div({className: 'blue'}, [
								Node.span({className: 'icon'}, 'schedule'),
								Node.span({className: 'value'}, self.getTimeWithUnits(uptime))
							])
						]),
						Node.div({className: 'card'}, [
							Node.p(Translator.get('esg.data_ingress')),
							Node.div([
								Node.span({className: 'icon'}, 'file_download'),
								Node.span({className: 'value'}, self.getBytesWithUnits(self.data.network.read)),
								Node.span({className: 'value'}, self.getWeightWithUnits(rco2e) + ' CO2e')
							])
						]),
						Node.div({className: 'card'}, [
							Node.p(Translator.get('esg.data_egress')),
							Node.div([
								Node.span({className: 'icon'}, 'file_upload'),
								Node.span({className: 'value'}, self.getBytesWithUnits(self.data.network.write)),
								Node.span({className: 'value'}, self.getWeightWithUnits(wco2e) + ' CO2e')
							])
						]),
						Node.div({className: 'card'}, [
							Node.p(Translator.get('esg.totalcpu')),
							Node.div([
								Node.span({className: 'icon'}, 'memory'),
								Node.span({className: 'value'}, self.getTimeWithUnits(cco2e)),
								Node.span({className: 'value'}, self.getWeightWithUnits(cpu_gco2e) + ' CO2e')
							])
						])
					);
				}, (error) =>
				{
					Notify.error(Translator.get('fetch.error'));
				});
			},
			
			refreshHourly: function()
			{
				var self = this;
				var div = document.getElementById('esg_hourly');
				while( div.firstChild ) div.firstChild.remove();
				
				var upratio = Node.div({className: 'esg_gauge'}, [
					Node.p(Translator.get('esg.co2e.upratio')), 
					self.createGauge('esg_hourly2_svg', ['#36B0FB', '#36B0FB', '#36B0FB'])
				]);
				var total = Node.div({className: 'esg_gauge'}, [
					Node.p(Translator.get('esg.co2e.total')), 
					self.createGauge('esg_hourly_svg')
				]);
				var network = Node.div({className: 'card'}, [
					Node.p(Translator.get('esg.co2e.network')),
					Node.div([
						Node.span({className: 'icon'}, 'wifi'),
						Node.span({className: 'value'}, '-')
					])
				]);
				var cpu = Node.div({className: 'card'}, [
					Node.p(Translator.get('esg.co2e.cpu')),
					Node.div([
						Node.span({className: 'icon'}, 'memory'),
						Node.span({className: 'value'}, '-')
					])
				]);
				var machine = Node.div({className: 'card'}, [
					Node.p(Translator.get('esg.co2e.machine')),
					Node.div([
						Node.span({className: 'icon'}, 'devices'),
						Node.span({className: 'value'}, '-')
					])
				]);
				var lifecycle = Node.div({className: 'card'}, [
					Node.p(Translator.get('esg.co2e.lifecycle')),
					Node.div([
						Node.span({className: 'icon'}, 'sync'),
						Node.span({className: 'value'}, '-')
					])
				]);
				
				div.append(upratio, total, Node.br(), network, cpu, machine, lifecycle);
				
				Ajax.get('/api/meta/usage', {data: {granularity: 'hour'}}).then((result) =>
				{
					var uptime_sec = 0;
					var cpu_time = 0;
					var network_bytes = 0;
					Object.values(result.response).forEach((v) => { 
						uptime_sec++;
						Object.values(v.threads).forEach((t) => { cpu_time += parseInt(t.cpu_time); });
						network_bytes += parseInt(v.network.read);
						network_bytes += parseInt(v.network.write);
					});
					uptime_sec *= 10; // monitoring is taken in 10s interval
					
					var net = parseFloat(document.getElementById('esg_i_net').value);
					var network_co2e = network_bytes / (1024*1024*1024) * net;
					const [ratio, min_gco2e, cpu_gco2e, max_gco2e] = self.computeCO2e(uptime_sec, cpu_time);
					var lr = parseFloat(document.getElementById('esg_i_lr').value) / 100;
					var lifecycle_co2e = (max_gco2e + network_co2e) * lr;
					
					self.setGauge('esg_hourly_svg', ratio, self.getWeightWithUnits(min_gco2e + cpu_gco2e + lifecycle_co2e + network_co2e));
					
					var time_ratio = Math.round(Object.keys(result.response).length / 360 * 100);
					self.setGauge('esg_hourly2_svg', time_ratio, time_ratio + '%');
					
					cpu.lastChild.lastChild.textContent = self.getWeightWithUnits(cpu_gco2e) + ' CO2e';
					network.lastChild.lastChild.textContent = self.getWeightWithUnits(network_co2e) + ' CO2e';
					machine.lastChild.lastChild.textContent = self.getWeightWithUnits(min_gco2e) + ' CO2e';
					lifecycle.lastChild.lastChild.textContent = self.getWeightWithUnits(lifecycle_co2e) + ' CO2e';
					
				}, (error) =>
				{
					Notify.error(Translator.get('fetch.error'));
				});
			},
			
			computeCO2e: function(uptime_sec, time)
			{
				var cores = this.data.hardware.cpu.cores;
					
				var tdp = parseFloat(document.getElementById('esg_i_tdp').value);
				var pue = parseFloat(document.getElementById('esg_i_pue').value);
				var eci = parseFloat(document.getElementById('esg_i_eci').value);
				var pcpu = parseFloat(document.getElementById('esg_i_pcpu').value);
				var cpur = parseFloat(document.getElementById('esg_i_cpur').value) / 100;
				
				var max_per_sec = tdp / (1 - cpur) * pue / 1000 * eci / 3600;
				var min_per_sec = max_per_sec * cpur;
				var cpu_pct_per_sec = (max_per_sec - min_per_sec) / 100;
				
				var cpu_sec = (time / 1000000000 / cores) * (cores / pcpu);
				var ratio = (cpu_sec / uptime_sec * 100);
				
				var cpu_gco2e = ratio * cpu_pct_per_sec * uptime_sec;
				var min_gco2e = min_per_sec * uptime_sec;
				var max_gco2e = max_per_sec * uptime_sec;
				
				return [ratio, min_gco2e, cpu_gco2e, max_gco2e];
			},
			
			getTimeWithUnits: function(ns)
			{
				if( ns < 1000 ) return Math.round(ns) + "ns";
				ns /= 1000;
				if( ns < 1000 ) return Math.round(ns) + "µs";
				ns /= 1000;
				if( ns < 1000 ) return Math.round(ns) + "ms";
				ns /= 1000;
				if( ns < 60 ) return Math.round(ns) + "s";
				ns /= 60;
				if( ns < 60 ) return Math.round(ns) + "min";
				ns /= 60;
				return Math.round(ns) + "h";
			},
			
			getBytesWithUnits: function(b)
			{
				if( b < 1024 ) return (Math.round(b * 100) / 100) + 'B';
				b /= 1024;
				if( b < 1024 ) return (Math.round(b * 100) / 100) + 'KB';
				b /= 1024;
				if( b < 1024 ) return (Math.round(b * 100) / 100) + 'MB';
				b /= 1024;
				if( b < 1024 ) return (Math.round(b * 100) / 100) + 'GB';
				b /= 1024;
				return (Math.round(b * 100) / 100) + 'TB';
			},
			
			getWeightWithUnits: function(g)
			{
				if( g < 1000 ) return (Math.round(g * 100) / 100) + 'g';
				g /= 1000;
				if( g < 1000 ) return (Math.round(g * 100) / 100) + 'Kg';
				g /= 1000;
				return (Math.round(g * 100) / 100) + 'T';
			},
			
			createGauge: function(id, colors)
			{
				if( !colors ) colors = ["#1eaa59", "#f1c40f", "#e84c3d"];
				
				return Node.svg({id: id, viewBox: '0 0 70 45', width: '100%'}, [
					Node.defs([
						Node.linearGradient({id: id+"_grad", gradientTransform: "rotate(15)"}, [
							Node.stop({offset: "10%", 'stop-color': colors[2]}),
							Node.stop({offset: "70%", 'stop-color': colors[1]}),
							Node.stop({offset: "100%", 'stop-color': colors[0]}),
						])
					]),
					Node.circle({
						r: "30", cx: "35", cy: "35", fill: "transparent",
						'stroke-width': "6",
						'stroke-dasharray': "100 188.5",
						transform: "rotate(174.5, 35, 35)",
						'stroke-linecap': "round",
						stroke: "#ffffff20"
					}),
					Node.circle({
						r: "30", cx: "35", cy: "35", fill: "transparent",
						'stroke-width': "6",
						'stroke-dasharray': "100 188.5",
						'stroke-dashoffset': "100",
						transform: "rotate(174.5, 35, 35)",
						'stroke-linecap': "round",
						stroke: "url(#" + id + "_grad)"
					}),
					Node.text({
						x: "50%", y: "35", fill: "#ffffff", 'font-size': "10",
						'font-family': "sans-serif",
						'dominant-baseline': "middle", 'text-anchor': "middle"
					})
				]);
			},
			
			setGauge: function(id, percent, label)
			{
				var svg = this.dom.querySelector('#' + id);
				svg.children[2].setAttribute('stroke-dashoffset', 100 - Math.min(100, Math.max(0, percent)));
				svg.children[3].textContent = label;
			}
		});
		
		ok(page);
	}, (e) => { nok(e); });
});

export { x as default };