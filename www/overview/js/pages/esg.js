
let ae = globalThis.ae;
var x = new Promise((ok, nok) =>
{
	ae.require('Page', 'Node', 'Ajax', 'Translator', 'Notify', 'Modal', 'page.esg.css').then(([Page, Node, Ajax, Translator, Notify, Modal]) =>
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
					Node.aside({className: 'settings'}, [
						Node.span({click: function(e) { self.disclaimer(); }, title: Translator.get('info')}, 'info'),
						Node.span({click: function(e) { document.getElementById('esg_assumptions').classList.add('open'); }, title: Translator.get('settings')}, 'settings')
					]),
					Node.div({id: 'esg_assumptions'}, [
						Node.aside({click: function(e) { this.parentNode.classList.remove('open'); }, title: Translator.get('close')}, 'close'),
						Node.label(Translator.get('esg.settings.cpu')),
						Node.input({type: 'number', id: 'esg_i_tdp', min: 1, max: 1000, step: 1, value: 150, change: function() { self.refresh(); }}),
						Node.label(Translator.get('esg.settings.pue')),
						Node.input({type: 'number', id: 'esg_i_pue', min: 1, max: 10, step: 0.01, value: 1.58, change: function() { self.refresh(); }}),
						Node.label(Translator.get('esg.settings.energy')),
						Node.input({type: 'number', id: 'esg_i_eci', min: 1, max: 10000, step: 1, value: 334, change: function() { self.refresh(); }}),
						Node.label(Translator.get('esg.settings.cores')),
						Node.input({type: 'number', id: 'esg_i_pcpu', min: 1, max: 256, step: 1, value: 0, change: function() { self.refresh(); }}),
						Node.label(Translator.get('esg.settings.network')),
						Node.input({type: 'number', id: 'esg_i_net', min: 1, max: 256, step: 0.01, value: 9.27, change: function() { self.refresh(); }}),
						Node.label(Translator.get('esg.settings.idleratio')),
						Node.input({type: 'number', id: 'esg_i_idle', min: 1, max: 100, step: 1, value: 28, change: function() { self.refresh(); }}),
					]),
					Node.div({className: 'block'}, [
						Node.h2(Translator.get('esg.title.uptime')),
						Node.div({id: 'esg_uptime'})
					]),
					Node.div({className: 'tab', dataset: {tab: 1}}, [
						Node.div({click: function(e) { self.switchTab(e.target); }}, [
							Node.span(Translator.get('esg.title.hourly')),
							Node.span(Translator.get('esg.title.daily')),
							Node.span(Translator.get('esg.title.monthly')),
							Node.span(Translator.get('esg.title.yearly'))
						]),
						Node.div([
							Node.div({className: 'tabcontent', id: 'esg_hourly'}),
							Node.div({className: 'tabcontent', id: 'esg_daily'}),
							Node.div({className: 'tabcontent', id: 'esg_monthly'}),
							Node.div({className: 'tabcontent', id: 'esg_yearly'})
						])
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
			
			disclaimer: function()
			{
				Modal.alert(Translator.get('esg.disclaimer'));
			},
			
			switchTab: function(node)
			{
				if( node.nodeName !== 'SPAN' ) return;
				
				var index = Array.prototype.indexOf.call(node.parentNode.childNodes, node) + 1;
				var t = node.parentNode.parentNode;
				t.dataset.tab = index;
				t.classList.toggle('changed');
			},
			
			refresh: function()
			{
				document.getElementById('esg_uptime').classList.add('wait');
				document.getElementById('esg_hourly').classList.add('wait');
				document.getElementById('esg_daily').classList.add('wait');
				document.getElementById('esg_monthly').classList.add('wait');
				document.getElementById('esg_yearly').classList.add('wait');
				
				this.refreshUptime();
				this.refreshHourly();
			},
			
			refreshUptime: function()
			{
				var self = this;
				var div = document.getElementById('esg_uptime');
				while( div.firstChild ) div.firstChild.remove();
				
				var density = Node.div({className: 'esg_gauge'}, [
					Node.p(Translator.get('esg.data_density')), 
					self.createGauge('esg_density_svg')
				]);
				var uptimec = Node.div({className: 'card'}, [
					Node.p(Translator.get('esg.uptime')),
					Node.div({className: 'blue'}, [
						Node.span({className: 'icon'}, 'schedule'),
						Node.span({className: 'value'}, '-')
					])
				]);
				var ingress = Node.div({className: 'card'}, [
					Node.p(Translator.get('esg.data_ingress')),
					Node.div([
						Node.span({className: 'icon'}, 'file_download'),
						Node.span({className: 'value'}, '-'),
						Node.span({className: 'value'}, '-')
					])
				]);
				var egress = Node.div({className: 'card'}, [
					Node.p(Translator.get('esg.data_egress')),
					Node.div([
						Node.span({className: 'icon'}, 'file_upload'),
						Node.span({className: 'value'}, '-'),
						Node.span({className: 'value'}, '-')
					])
				]);
				var cpu = Node.div({className: 'card'}, [
					Node.p(Translator.get('esg.totalcpu')),
					Node.div([
						Node.span({className: 'icon'}, 'memory'),
						Node.span({className: 'value'}, '-'),
						Node.span({className: 'value'}, '-')
					])
				])
					
				div.append(density, Node.br(), uptimec, ingress, egress, cpu);
				
				Ajax.get('/api/meta/system').then((result) =>
				{
					var uptime = (result.response.system.time - result.response.system.boot) * 1000000;
					
					var net = parseFloat(document.getElementById('esg_i_net').value);
					var rco2e = self.data.network.read / (1024*1024*1024) * net;
					var wco2e = self.data.network.write / (1024*1024*1024) * net;
					var cco2e = Object.values(self.data.usage).reduce((a, c) => a + c.cpu_time, 0);
					const [ratio, min_gco2e, cpu_gco2e, max_gco2e] = self.computeCO2e(uptime, cco2e);
					
					uptimec.lastChild.lastChild.textContent = self.getTimeWithUnits(uptime);
					ingress.lastChild.lastChild.textContent = self.getWeightWithUnits(rco2e) + ' CO2e';
					ingress.lastChild.lastChild.previousSibling.textContent = self.getBytesWithUnits(self.data.network.read);
					egress.lastChild.lastChild.textContent = self.getWeightWithUnits(wco2e) + ' CO2e';
					egress.lastChild.lastChild.previousSibling.textContent = self.getBytesWithUnits(self.data.network.write);
					cpu.lastChild.lastChild.textContent = self.getWeightWithUnits(cpu_gco2e) + ' CO2e';
					cpu.lastChild.lastChild.previousSibling.textContent = self.getTimeWithUnits(cco2e);
					
					var lt = Object.values(self.data.tasks).reduce((a, c) => a + c.time, 0);
					var ltratio = Math.round(cco2e / lt * 100) / 100;
					self.setGauge('esg_density_svg', ltratio, ltratio + '%');
					
					div.classList.remove('wait');
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
					var network_co2e = network_bytes / (1024*1024*1024) * (net * 1.012);
					const [ratio, min_gco2e, cpu_gco2e, max_gco2e] = self.computeCO2e(uptime_sec, cpu_time);
					var lr = (100 - (7800 / (parseFloat(document.getElementById('esg_i_eci').value) + 85))) / 100;
					var lifecycle_co2e = (max_gco2e / parseFloat(document.getElementById('esg_i_pue').value) * (1-lr)) + (network_co2e * net * 0.013);
					
					self.setGauge('esg_hourly_svg', ratio, self.getWeightWithUnits(min_gco2e + cpu_gco2e + lifecycle_co2e + network_co2e));
					
					var time_ratio = Math.round(Object.keys(result.response).length / 360 * 100);
					self.setGauge('esg_hourly2_svg', time_ratio, time_ratio + '%');
					
					cpu.lastChild.lastChild.textContent = self.getWeightWithUnits(cpu_gco2e) + ' CO2e';
					network.lastChild.lastChild.textContent = self.getWeightWithUnits(network_co2e) + ' CO2e';
					machine.lastChild.lastChild.textContent = self.getWeightWithUnits(min_gco2e) + ' CO2e';
					lifecycle.lastChild.lastChild.textContent = self.getWeightWithUnits(lifecycle_co2e) + ' CO2e';
					
					div.classList.remove('wait');
					self._hourly = [uptime_sec, cpu_time, network_bytes];
					self.refreshDaily();
				}, (error) =>
				{
					Notify.error(Translator.get('fetch.error'));
				});
			},
			
			refreshDaily: function()
			{
				var self = this;
				var div = document.getElementById('esg_daily');
				while( div.firstChild ) div.firstChild.remove();
				
				var upratio = Node.div({className: 'esg_gauge'}, [
					Node.p(Translator.get('esg.co2e.upratio')), 
					self.createGauge('esg_daily2_svg', ['#36B0FB', '#36B0FB', '#36B0FB'])
				]);
				var total = Node.div({className: 'esg_gauge'}, [
					Node.p(Translator.get('esg.co2e.total')), 
					self.createGauge('esg_daily_svg')
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
				
				Ajax.get('/api/meta/usage', {data: {granularity: 'day'}}).then((result) =>
				{
					var uptime_sec = 0;
					var cpu_time = 0;
					var network_bytes = 0;
					Object.values(result.response).forEach((v) => { 
						uptime_sec += parseInt(v.network.n); // we suppose that network is aligned with threads
						Object.values(v.threads).forEach((t) => { cpu_time += parseInt(t.cpu_time.sum); });
						network_bytes += parseInt(v.network.read.sum);
						network_bytes += parseInt(v.network.write.sum);
					});
					uptime_sec *= 10; // monitoring is taken in 10s interval
					
					// we should add the current hour data
					uptime_sec += self._hourly[0];
					cpu_time += self._hourly[1];
					network_bytes += self._hourly[2];
					
					var net = parseFloat(document.getElementById('esg_i_net').value);
					var network_co2e = network_bytes / (1024*1024*1024) * (net * 1.012);
					const [ratio, min_gco2e, cpu_gco2e, max_gco2e] = self.computeCO2e(uptime_sec, cpu_time);
					var lr = (100 - (7800 / (parseFloat(document.getElementById('esg_i_eci').value) + 85))) / 100;
					var lifecycle_co2e = (max_gco2e / parseFloat(document.getElementById('esg_i_pue').value) * (1-lr)) + (network_co2e * net * 0.013);
					
					self.setGauge('esg_daily_svg', ratio, self.getWeightWithUnits(min_gco2e + cpu_gco2e + lifecycle_co2e + network_co2e));
					
					var time_ratio = Math.round(Object.keys(result.response).length / (360*24) * 100);
					self.setGauge('esg_daily2_svg', time_ratio, time_ratio + '%');
					
					cpu.lastChild.lastChild.textContent = self.getWeightWithUnits(cpu_gco2e) + ' CO2e';
					network.lastChild.lastChild.textContent = self.getWeightWithUnits(network_co2e) + ' CO2e';
					machine.lastChild.lastChild.textContent = self.getWeightWithUnits(min_gco2e) + ' CO2e';
					lifecycle.lastChild.lastChild.textContent = self.getWeightWithUnits(lifecycle_co2e) + ' CO2e';
					
					div.classList.remove('wait');
					self._daily = [uptime_sec, cpu_time, network_bytes];
					self.refreshYearly();
				}, (error) =>
				{
					Notify.error(Translator.get('fetch.error'));
				});
			},
			
			refreshYearly: function()
			{
				/* ==========
				 * Caution, this method computes the monthly & yearly because
				 * the data is in the same API call
				 * ==========
				 */
				
				var self = this;
				var div_m = document.getElementById('esg_monthly');
				while( div_m.firstChild ) div_m.firstChild.remove();
				
				var upratio_m = Node.div({className: 'esg_gauge'}, [
					Node.p(Translator.get('esg.co2e.upratio')), 
					self.createGauge('esg_monthly2_svg', ['#36B0FB', '#36B0FB', '#36B0FB'])
				]);
				var total_m = Node.div({className: 'esg_gauge'}, [
					Node.p(Translator.get('esg.co2e.total')), 
					self.createGauge('esg_monthly_svg')
				]);
				var network_m = Node.div({className: 'card'}, [
					Node.p(Translator.get('esg.co2e.network')),
					Node.div([
						Node.span({className: 'icon'}, 'wifi'),
						Node.span({className: 'value'}, '-')
					])
				]);
				var cpu_m = Node.div({className: 'card'}, [
					Node.p(Translator.get('esg.co2e.cpu')),
					Node.div([
						Node.span({className: 'icon'}, 'memory'),
						Node.span({className: 'value'}, '-')
					])
				]);
				var machine_m = Node.div({className: 'card'}, [
					Node.p(Translator.get('esg.co2e.machine')),
					Node.div([
						Node.span({className: 'icon'}, 'devices'),
						Node.span({className: 'value'}, '-')
					])
				]);
				var lifecycle_m = Node.div({className: 'card'}, [
					Node.p(Translator.get('esg.co2e.lifecycle')),
					Node.div([
						Node.span({className: 'icon'}, 'sync'),
						Node.span({className: 'value'}, '-')
					])
				]);
				
				div_m.append(upratio_m, total_m, Node.br(), network_m, cpu_m, machine_m, lifecycle_m);
				
				var div_y = document.getElementById('esg_yearly');
				while( div_y.firstChild ) div_y.firstChild.remove();
				
				var upratio_y = Node.div({className: 'esg_gauge'}, [
					Node.p(Translator.get('esg.co2e.upratio')), 
					self.createGauge('esg_yearly2_svg', ['#36B0FB', '#36B0FB', '#36B0FB'])
				]);
				var total_y = Node.div({className: 'esg_gauge'}, [
					Node.p(Translator.get('esg.co2e.total')), 
					self.createGauge('esg_yearly_svg')
				]);
				var network_y = Node.div({className: 'card'}, [
					Node.p(Translator.get('esg.co2e.network')),
					Node.div([
						Node.span({className: 'icon'}, 'wifi'),
						Node.span({className: 'value'}, '-')
					])
				]);
				var cpu_y = Node.div({className: 'card'}, [
					Node.p(Translator.get('esg.co2e.cpu')),
					Node.div([
						Node.span({className: 'icon'}, 'memory'),
						Node.span({className: 'value'}, '-')
					])
				]);
				var machine_y = Node.div({className: 'card'}, [
					Node.p(Translator.get('esg.co2e.machine')),
					Node.div([
						Node.span({className: 'icon'}, 'devices'),
						Node.span({className: 'value'}, '-')
					])
				]);
				var lifecycle_y = Node.div({className: 'card'}, [
					Node.p(Translator.get('esg.co2e.lifecycle')),
					Node.div([
						Node.span({className: 'icon'}, 'sync'),
						Node.span({className: 'value'}, '-')
					])
				]);
				
				div_y.append(upratio_y, total_y, Node.br(), network_y, cpu_y, machine_y, lifecycle_y);
				
				Ajax.get('/api/meta/usage', {data: {granularity: 'year'}}).then((result) =>
				{
					var uptime_sec = 0;
					var cpu_time = 0;
					var network_bytes = 0;
					
					var now = new Date();
					var key_prefix = "m" + ("0" + (now.getMonth()+1)).substr(-2) + "d";
					var number_of_days_in_month = new Date(now.getFullYear(), now.getMonth()+1, 0).getDate();
					for( let [k, v] of Object.entries(result.response) ) { 
						if( !k.startsWith(key_prefix) ) continue;
						uptime_sec += parseInt(v.network.n); // we suppose that network is aligned with threads
						Object.values(v.threads).forEach((t) => { cpu_time += parseInt(t.cpu_time.sum); });
						network_bytes += parseInt(v.network.read.sum);
						network_bytes += parseInt(v.network.write.sum);
					};
					uptime_sec *= 10; // monitoring is taken in 10s interval
					
					// we should add the current day data
					uptime_sec = 31536000;//+= self._daily[0];
					cpu_time += self._daily[1];
					network_bytes += self._daily[2];
					
					var net = parseFloat(document.getElementById('esg_i_net').value);
					var network_co2e = network_bytes / (1024*1024*1024) * (net * 1.012);
					var [ratio, min_gco2e, cpu_gco2e, max_gco2e] = self.computeCO2e(uptime_sec, cpu_time);
					var lr = (100 - (7800 / (parseFloat(document.getElementById('esg_i_eci').value) + 85))) / 100;
					var lifecycle_co2e = (max_gco2e / parseFloat(document.getElementById('esg_i_pue').value) * (1-lr)) + (network_co2e * net * 0.013);
					
					self.setGauge('esg_monthly_svg', ratio, self.getWeightWithUnits(min_gco2e + cpu_gco2e + lifecycle_co2e + network_co2e));
					
					var time_ratio = Math.round(Object.keys(result.response).length / (360*24*number_of_days_in_month) * 100);
					self.setGauge('esg_monthly2_svg', time_ratio, time_ratio + '%');
					
					cpu_m.lastChild.lastChild.textContent = self.getWeightWithUnits(cpu_gco2e) + ' CO2e';
					network_m.lastChild.lastChild.textContent = self.getWeightWithUnits(network_co2e) + ' CO2e';
					machine_m.lastChild.lastChild.textContent = self.getWeightWithUnits(min_gco2e) + ' CO2e';
					lifecycle_m.lastChild.lastChild.textContent = self.getWeightWithUnits(lifecycle_co2e) + ' CO2e';
					
					div_m.classList.remove('wait');
					
					uptime_sec = 0;
					cpu_time = 0;
					network_bytes = 0;
					var number_of_days_in_year = ((now.getFullYear() % 4 == 0) && (now.getFullYear() % 100 != 0)) || (now.getFullYear() % 400 == 0) ? 366 : 365;
					Object.values(result.response).forEach((v) => { 
						uptime_sec += parseInt(v.network.n); // we suppose that network is aligned with threads
						Object.values(v.threads).forEach((t) => { cpu_time += parseInt(t.cpu_time.sum); });
						network_bytes += parseInt(v.network.read.sum);
						network_bytes += parseInt(v.network.write.sum);
					});
					uptime_sec *= 10; // monitoring is taken in 10s interval
					
					// we should add the current day data
					uptime_sec += self._daily[0];
					cpu_time += self._daily[1];
					network_bytes += self._daily[2];
					
					net = parseFloat(document.getElementById('esg_i_net').value);
					network_co2e = network_bytes / (1024*1024*1024) * (net * 1.012);
					[ratio, min_gco2e, cpu_gco2e, max_gco2e] = self.computeCO2e(uptime_sec, cpu_time);
					lr = (100 - (7800 / (parseFloat(document.getElementById('esg_i_eci').value) + 85))) / 100;
					lifecycle_co2e = (max_gco2e / parseFloat(document.getElementById('esg_i_pue').value) * (1-lr)) + (network_co2e * net * 0.013);
					
					self.setGauge('esg_yearly_svg', ratio, self.getWeightWithUnits(min_gco2e + cpu_gco2e + lifecycle_co2e + network_co2e));
					
					time_ratio = Math.round(Object.keys(result.response).length / (360*24*number_of_days_in_year) * 100);
					self.setGauge('esg_yearly2_svg', time_ratio, time_ratio + '%');
					
					cpu_y.lastChild.lastChild.textContent = self.getWeightWithUnits(cpu_gco2e) + ' CO2e';
					network_y.lastChild.lastChild.textContent = self.getWeightWithUnits(network_co2e) + ' CO2e';
					machine_y.lastChild.lastChild.textContent = self.getWeightWithUnits(min_gco2e) + ' CO2e';
					lifecycle_y.lastChild.lastChild.textContent = self.getWeightWithUnits(lifecycle_co2e) + ' CO2e';
					
					div_y.classList.remove('wait');
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
				var cpur = 1 - (parseFloat(document.getElementById('esg_i_idle').value) / 100);
				
				var min_per_sec = (1 - cpur) * (tdp / cpur) * pue * (eci / 1000 / 3600);
				var max_per_sec = min_per_sec + (tdp * pue * (eci / 1000 / 3600));
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