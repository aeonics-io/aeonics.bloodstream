
let ae = globalThis.ae;
var x = new Promise((ok, nok) =>
{
	ae.require('Page', 'Node', 'Ajax', 'Translator', 'Notify', 'ext/chart.min.js', 'page.stats.css').then(([Page, Node, Ajax, Translator, Notify]) =>
	{
		var colors = ['#D21D50c0', '#36B0FBc0', '#29C64Bc0', '#FB8136c0', '#FFFFFFc0'];
		var page = new Page();
		Object.assign(page, 
		{
			show: function()
			{
				this.dom.classList.add('statistics');
				
				this.init();
				var self = this;
				this.__refreshSystemInterval = setInterval(function() { self.initSystem(); }, 1000);
				return Promise.resolve();
			},
			
			hide: function()
			{
				this.data_hourly = null;
				this.data_daily = null;
				this.data_yearly = null;
				
				if( this.graph_hourly ) { this.graph_hourly.destroy(); this.graph_hourly = null; }
				if( this.graph_daily ) { this.graph_daily.destroy(); this.graph_daily = null; }
				if( this.graph_yearly ) { this.graph_yearly.destroy(); this.graph_yearly = null; }
				
				while(this.dom.firstChild) this.dom.firstChild.remove();
				
				if( this.__refreshSystemInterval )
				{
					clearInterval(this.__refreshSystemInterval);
					this.__refreshSystemInterval = null;
				}
				
				return Promise.resolve(); 
			},
			
			init: function()
			{
				var self = this;
				
				this.dom.append(
					Node.div({id: 'panel_graph'},
					[
						Node.div({id: 'hourly'}),
						Node.div({id: 'daily'}),
						Node.div({id: 'yearly'})
					]),
					Node.div({id: 'panel_facts'}, Node.ul(
					[
						Node.li({id: 'fact_cpu'}),
						Node.li({id: 'fact_hourly'}),
						Node.li({id: 'fact_uptime'}),
						Node.li({id: 'fact_memoryheap'}),
						Node.li({id: 'fact_memorynonheap'}),
						Node.li({id: 'fact_memorycommitted'}),
						Node.li({id: 'fact_tasks'}),
						Node.li({id: 'fact_pending'}),
						Node.li({id: 'fact_avgtime'})
					]))
				);
				
				this.initHourly();
				this.initDaily();
				this.initYearly();
				this.initSystem();
			},
			
			initSystem: function()
			{
				var self = this;
				
				Ajax.get('/api/meta/system').then((result) =>
				{
					var uptime = (result.response.system.time - result.response.system.boot) / 1000;
					const pad = (num) => String(num).padStart(2, '0');
					const hrs = Math.floor(uptime / 3600);
					const mins = Math.floor((uptime % 3600) / 60);
					const secs = Math.floor(uptime % 60);
					self.dom.querySelector('#fact_uptime').innerHTML = Translator.get('stats.fact.uptime', pad(hrs), pad(mins), pad(secs));
				}, (error) =>
				{
					Notify.error(Translator.get('fetch.error'));
				});
				
				Ajax.get('/api/meta/probe').then((result) =>
				{
					const pad = (num) => String(num).padStart(2, '0');
					const timeunit = (ns) => {
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
					};
					
					var pending = result.response.tasks.normal.pending + result.response.tasks.background.pending + result.response.tasks.priority.pending + result.response.tasks.io.pending;
					var tasks = (result.response.tasks.normal.submitted + result.response.tasks.background.submitted + result.response.tasks.priority.submitted + result.response.tasks.io.submitted) - pending;
					self.dom.querySelector('#fact_pending').innerHTML = Translator.get('stats.fact.pending', pending);
					self.dom.querySelector('#fact_tasks').innerHTML = Translator.get('stats.fact.tasks', tasks);
					
					var speed = (
						result.response.tasks.normal.time + 
						result.response.tasks.background.time + 
						result.response.tasks.priority.time + 
						result.response.tasks.io.time
						) / (
						result.response.tasks.normal.completed + 
						result.response.tasks.background.completed + 
						result.response.tasks.priority.completed + 
						result.response.tasks.io.completed
						);
					self.dom.querySelector('#fact_avgtime').innerHTML = Translator.get('stats.fact.avgtime', timeunit(speed));
					
					self.dom.querySelector('#fact_cpu').innerHTML = Translator.get('stats.fact.currentcpu', Math.min(100, Math.max(0, Math.round(result.response.hardware.cpu.process)*100)));
					
					self.dom.querySelector('#fact_memoryheap').innerHTML = Translator.get('stats.fact.memoryheap', Math.round(result.response.hardware.ram.heap.used / (1024*1024)));
					self.dom.querySelector('#fact_memorynonheap').innerHTML = Translator.get('stats.fact.memorynonheap', Math.round(result.response.hardware.ram.nonheap.used / (1024*1024)));
					self.dom.querySelector('#fact_memorycommitted').innerHTML = Translator.get('stats.fact.memorycommitted', Math.round(result.response.hardware.ram.physical.process / (1024*1024)));
				}, (error) =>
				{
					Notify.error(Translator.get('fetch.error'));
				});	
			},
			
			initHourly: function()
			{
				var self = this;
				var dom = this.dom.querySelector('#hourly');
				while(dom.firstChild) dom.firstChild.remove();
				
				dom.append(
					Node.h2(Translator.get('stats.hourly')),
					Node.div({className: 'series'}, [
						Node.input({type: 'radio', id: 'radio_hourly_cpu', name: 'hourly_series', value: 'cpu', checked: true, change: function() { if(this.checked) self.filterHourly(); }}),
						Node.label({htmlFor: 'radio_hourly_cpu'}, Translator.get('stats.series.cpu')),
						Node.input({type: 'radio', id: 'radio_hourly_blocked', name: 'hourly_series', value: 'blocked', change: function() { if(this.checked) self.filterHourly(); }}),
						Node.label({htmlFor: 'radio_hourly_blocked'}, Translator.get('stats.series.blocked')),
						Node.input({type: 'radio', id: 'radio_hourly_waiting', name: 'hourly_series', value: 'waited', change: function() { if(this.checked) self.filterHourly(); }}),
						Node.label({htmlFor: 'radio_hourly_waiting'}, Translator.get('stats.series.waiting')),
						Node.button({className: 'raised icon', click: function(e) { e.preventDefault(); self.initHourly(); }}, 'refresh')
					]),
					Node.div({classList: 'graph'}, [
						Node.div({classList: 'canvas'}, Node.canvas()),
						Node.div({classList: 'threads'})
					])
				);
				
				dom.classList.add('wait');
				Ajax.get('/api/meta/usage', {data: {granularity: 'hour'}}).then((result) =>
				{
					self.data_hourly = result.response;
					
					// fill thread list
					var threads = [];
					var sum = 0;
					Object.values(self.data_hourly).forEach((m) =>
					{
						for( const [key, value] of Object.entries(m.threads) )
						{
							if( !threads.find((e) => e.id == key) )
							{
								sum += parseInt(value.cpu_time);
								threads.push({id: key, name: value.name});
							}
						}
					});
					dom.querySelector('.threads').append(
						...threads.sort((a, b) => { parseInt(a.id) > parseInt(b.id) ? 1 : -1; })
						.map((t, i) => Node.p([
							Node.input({dataset: {color: colors[i%5]}, type: 'checkbox', id: 'check_hourly_' + t.id, value: t.id, checked: true, change: function() { self.filterHourly(); }}),
							Node.label({htmlFor: 'check_hourly_' + t.id}, ae.safeHtml("#" + t.id + " " + t.name))
						]))
					);
					
					// setup graph
					var labels = [];
					var h = new Date().getHours();
					for( var m = 0; m < 60; m++ )
						for( var s = 0; s < 6; s++ )
							labels.push(h + ':' + ('0' + m).substr(-2) + ':' + s + '0');
					
					if( self.graph_hourly ) self.graph_hourly.destroy();
					self.graph_hourly = new Chart(dom.querySelector('canvas').getContext('2d'),
					{
						type: 'line',
						data: {
							labels: labels,
							datasets: []
						},
						options:
						{
							datasets: { 
								line: { 
									borderColor: '#36B0FB', pointRadius: Object.keys(self.data_hourly).length > 1 ? 1 : 3,
									borderWidth: 0.5
								}},
							plugins: {
								title: { display: false },
								legend: { display: false },
								tooltip: { enabled: true },
								zoom: {
									zoom: { wheel: { enabled: true }, pinch: { enabled: true }, mode: 'xy', drag: { enabled: true, modifierKey: 'ctrl' } },
									pan: { enabled: true, mode: 'xy' },
									limits: { y: {min: 0, max: 100} }
								}
							},
							layout: { padding: 5 },
							responsive: true,
							interaction: { mode: 'index', intersect: false },
							maintainAspectRatio: false,
							resizeDelay: 250,
							scales: {
								x: {
									title: { 
										text: Translator.get('time'),
										display: true
									},
									ticks: {
										display: true,
									},
									grid: { display: false }
								},
								y: {
									title: {text: Translator.get('time_ratio'), display: true},
									type: 'linear',
									min: 0, max: 100, position: 'left',
									grid: { color: '#333' }
								},
								y1: {
									title: {text: Translator.get('scale_network'), display: true},
									type: 'linear', min: 0, max: 1000,
									position: 'right', grid: { drawOnChartArea: false }
								}
							}
						}
					});
					
					// filter
					self.filterHourly();
					
					// facts
					self.dom.querySelector('#fact_hourly').innerHTML = Translator.get('stats.fact.hourly', Math.round(sum / 1000000));
					
					dom.classList.remove('wait');
				}, (error) =>
				{
					dom.classList.remove('wait');
					Notify.error(Translator.get('fetch.error'));
				});
			},
			
			filterHourly: function()
			{
				var self = this;
				var dom = this.dom.querySelector('#hourly');
				
				var metric = dom.querySelector('input[type="radio"]:checked').value + "_time";
				
				var ingress = [];
				var egress = [];
				
				var datasets = [...dom.querySelectorAll('input[type="checkbox"]:checked')].map((i) =>
				{
					const data = [];
					for( var m = 0; m < 60; m++ )
					{
						for( var s = 0; s < 6; s++ )
						{
							var d = self.data_hourly['m' + ('0' + m).substr(-2) + 's' + s + '0'] || {threads: {}, network: {}};

							var r = d.network.read || null;
							if( !r ) ingress.push(r);
							else ingress.push(parseInt(r)/1024/1024);

							var w = d.network.write || null;
							if( !w ) egress.push(w);
							else egress.push(parseInt(w)/1024/1024);
							
							d = d.threads[i.value] || null;
							if( !d ) { data.push(null); continue; }
							d = parseInt(d[metric]);
							if( d < 0 ) { data.push(null); continue; }
							data.push(Math.min(100, d/100000000));
						}
					}
					
					return { label: i.nextSibling.textContent, data: data, borderColor: i.dataset.color, yAxisID: 'y'};
				});
				
				datasets.push({ label: "Network Ingress", data: ingress, borderColor: "#FB8136", yAxisID: 'y1'});
				datasets.push({ label: "Network Egress", data: egress, borderColor: "#36B0FB", yAxisID: 'y1'});
				
				self.graph_hourly.data.datasets = datasets;
				self.graph_hourly.update();
			},
			
			initDaily: function(data)
			{
				var self = this;
				var dom = this.dom.querySelector('#daily');
				while(dom.firstChild) dom.firstChild.remove();
				
				dom.append(
					Node.h2(Translator.get('stats.daily')),
					Node.div({className: 'series'}, [
						Node.input({type: 'radio', id: 'radio_daily_cpu', name: 'daily_series', value: 'cpu', checked: true, change: function() { if(this.checked) self.filterDaily(); }}),
						Node.label({htmlFor: 'radio_daily_cpu'}, Translator.get('stats.series.cpu')),
						Node.input({type: 'radio', id: 'radio_daily_blocked', name: 'daily_series', value: 'blocked', change: function() { if(this.checked) self.filterDaily(); }}),
						Node.label({htmlFor: 'radio_daily_blocked'}, Translator.get('stats.series.blocked')),
						Node.input({type: 'radio', id: 'radio_daily_waiting', name: 'daily_series', value: 'waited', change: function() { if(this.checked) self.filterDaily(); }}),
						Node.label({htmlFor: 'radio_daily_waiting'}, Translator.get('stats.series.waiting')),
						Node.button({className: 'raised icon', click: function(e) { e.preventDefault(); self.initDaily(); }}, 'refresh')
					]),
					Node.div({classList: 'graph'}, [
						Node.div({classList: 'canvas'}, Node.canvas()),
						Node.div({classList: 'threads'})
					])
				);
				
				dom.classList.add('wait');
				Ajax.get('/api/meta/usage', {data: {granularity: 'day'}}).then((result) =>
				{
					self.data_daily = result.response;
					
					// fill thread list
					var threads = [];
					var sum = 0;
					Object.values(self.data_daily).forEach((m) =>
					{
						for( const [key, value] of Object.entries(m.threads) )
						{
							if( !threads.find((e) => e.id == key) )
							{
								sum += parseInt(value.cpu_time.sum);
								threads.push({id: key, name: value.name});
							}
						}
					});
					dom.querySelector('.threads').append(
						...threads.sort((a, b) => { parseInt(a.id) > parseInt(b.id) ? 1 : -1; })
						.map((t, i) => Node.p([
							Node.input({dataset: {color: colors[i%5]}, type: 'checkbox', id: 'check_daily_' + t.id, value: t.id, checked: true, change: function() { self.filterDaily(); }}),
							Node.label({htmlFor: 'check_daily_' + t.id}, ae.safeHtml("#" + t.id + " " + t.name))
						]))
					);
					
					// setup graph
					var labels = [];
					for( var h = 0; h < 24; h++ )
						labels.push(('0' + h).substr(-2));
					
					if( self.graph_daily ) self.graph_daily.destroy();
					self.graph_daily = new Chart(dom.querySelector('canvas').getContext('2d'),
					{
						type: 'line',
						data: {
							labels: labels,
							datasets: []
						},
						options:
						{
							datasets: { 
								line: { 
									borderColor: '#36B0FB', pointRadius: Object.keys(self.data_daily).length > 1 ? 1 : 3,
									borderWidth: 0.5
								}},
							plugins: {
								title: { display: false },
								legend: { display: false },
								tooltip: { enabled: true },
								zoom: {
									zoom: { wheel: { enabled: true }, pinch: { enabled: true }, mode: 'xy', drag: { enabled: true, modifierKey: 'ctrl' } },
									pan: { enabled: true, mode: 'xy' },
									limits: { y: {min: 0, max: 100} }
								}
							},
							layout: { padding: 5 },
							responsive: true,
							interaction: { mode: 'index', intersect: false },
							maintainAspectRatio: false,
							resizeDelay: 250,
							scales: {
								x: {
									title: { 
										text: Translator.get('time'),
										display: true
									},
									ticks: {
										display: true,
									},
									grid: { display: false }
								},
								y: {
									title: {text: Translator.get('time_ratio'), display: true},
									type: 'linear',
									min: 0, max: 100, position: 'left',
									grid: { color: '#333' }
								},
								y1: {
									title: {text: Translator.get('scale_network'), display: false},
									type: 'linear', min: 0, max: 1000,
									position: 'right', grid: { drawOnChartArea: false }
								}
							}
						}
					});
					
					// filter
					self.filterDaily();
					
					dom.classList.remove('wait');
				}, (error) =>
				{
					dom.classList.remove('wait');
					Notify.error(Translator.get('fetch.error'));
				});
			},
			
			filterDaily: function()
			{
				var self = this;
				var dom = this.dom.querySelector('#daily');
				
				var metric = dom.querySelector('input[type="radio"]:checked').value + "_time";
				
				var ingress = [];
				var egress = [];
				
				var datasets = [...dom.querySelectorAll('input[type="checkbox"]:checked')].map((i) =>
				{
					const data = [];
					for( var h = 0; h < 24; h++ )
					{
						var d = self.data_daily['h' + ('0' + h).substr(-2)] || {threads: {}, network: {}};

						var r = d.network.read || null;
						if( !r ) ingress.push(r);
						else ingress.push(parseInt(r.avg)/1024/1024);

						var w = d.network.write || null;
						if( !w ) egress.push(w);
						else egress.push(parseInt(w.avg)/1024/1024);
							
						d = d.threads[i.value] || null;
						if( !d ) { data.push(null); continue; }
						d = parseInt(d[metric].avg);
						if( d < 0 ) { data.push(null); continue; }
						data.push(Math.min(100, d/100000000));
					}
					
					return { label: i.nextSibling.textContent, data: data, borderColor: i.dataset.color, yAxisID: 'y'};
				});
				
				datasets.push({ label: "Network Ingress", data: ingress, borderColor: "#FB8136", yAxisID: 'y1'});
				datasets.push({ label: "Network Egress", data: egress, borderColor: "#36B0FB", yAxisID: 'y1'});
				
				self.graph_daily.data.datasets = datasets;
				self.graph_daily.update();
			},
			
			initYearly: function(data)
			{
				var self = this;
				var dom = this.dom.querySelector('#yearly');
				while(dom.firstChild) dom.firstChild.remove();
				
				dom.append(
					Node.h2(Translator.get('stats.yearly')),
					Node.div({className: 'series'}, [
						Node.input({type: 'radio', id: 'radio_yearly_cpu', name: 'yearly_series', value: 'cpu', checked: true, change: function() { if(this.checked) self.filterYearly(); }}),
						Node.label({htmlFor: 'radio_yearly_cpu'}, Translator.get('stats.series.cpu')),
						Node.input({type: 'radio', id: 'radio_yearly_blocked', name: 'yearly_series', value: 'blocked', change: function() { if(this.checked) self.filterYearly(); }}),
						Node.label({htmlFor: 'radio_yearly_blocked'}, Translator.get('stats.series.blocked')),
						Node.input({type: 'radio', id: 'radio_yearly_waiting', name: 'yearly_series', value: 'waited', change: function() { if(this.checked) self.filterYearly(); }}),
						Node.label({htmlFor: 'radio_yearly_waiting'}, Translator.get('stats.series.waiting')),
						Node.button({className: 'raised icon', click: function(e) { e.preventDefault(); self.initYearly(); }}, 'refresh')
					]),
					Node.div({classList: 'graph'}, [
						Node.div({classList: 'canvas'}, Node.canvas()),
						Node.div({classList: 'threads'})
					])
				);
				
				dom.classList.add('wait');
				Ajax.get('/api/meta/usage', {data: {granularity: 'year', year: new Date().getFullYear()}}).then((result) =>
				{
					self.data_yearly = result.response;
					
					// fill thread list
					var threads = [];
					var sum = 0;
					Object.values(self.data_yearly).forEach((m) =>
					{
						for( const [key, value] of Object.entries(m.threads) )
						{
							if( !threads.find((e) => e.id == key) )
							{
								sum += parseInt(value.cpu_time.sum);
								threads.push({id: key, name: value.name});
							}
						}
					});
					dom.querySelector('.threads').append(
						...threads.sort((a, b) => { parseInt(a.id) > parseInt(b.id) ? 1 : -1; })
						.map((t, i) => Node.p([
							Node.input({dataset: {color: colors[i%5]}, type: 'checkbox', id: 'check_yearly_' + t.id, value: t.id, checked: true, change: function() { self.filterYearly(); }}),
							Node.label({htmlFor: 'check_yearly_' + t.id}, ae.safeHtml("#" + t.id + " " + t.name))
						]))
					);
					
					// setup graph
					var labels = [];
					var end = new Date(new Date().getFullYear()+1, 0, 1);
					for( var d = new Date(new Date().getFullYear(), 0, 1); d < end; d.setDate(d.getDate() + 1))
						labels.push(d.toLocaleString([], {month: 'long', day: 'numeric'}));
					
					if( self.graph_yearly ) self.graph_yearly.destroy();
					self.graph_yearly = new Chart(dom.querySelector('canvas').getContext('2d'),
					{
						type: 'line',
						data: {
							labels: labels,
							datasets: []
						},
						options:
						{
							datasets: { 
								line: { 
									borderColor: '#36B0FB', pointRadius: Object.keys(self.data_yearly).length > 1 ? 1 : 3,
									borderWidth: 0.5
								}},
							plugins: {
								title: { display: false },
								legend: { display: false },
								tooltip: { enabled: true },
								zoom: {
									zoom: { wheel: { enabled: true }, pinch: { enabled: true }, mode: 'xy', drag: { enabled: true, modifierKey: 'ctrl' } },
									pan: { enabled: true, mode: 'xy' },
									limits: { y: {min: 0, max: 100} }
								}
							},
							layout: { padding: 5 },
							responsive: true,
							maintainAspectRatio: false,
							interaction: { mode: 'index', intersect: false },
							resizeDelay: 250,
							scales: {
								x: {
									title: { 
										text: Translator.get('time'),
										display: true
									},
									ticks: {
										display: true,
									},
									grid: { display: false }
								},
								y: {
									title: {text: Translator.get('time_ratio'), display: true},
									type: 'linear',
									min: 0, max: 100, position: 'left',
									grid: { color: '#333' }
								},
								y1: {
									title: {text: Translator.get('scale_network'), display: true},
									type: 'linear', min: 0, max: 1000,
									position: 'right', grid: { drawOnChartArea: false }
								}
							}
						}
					});
					
					// filter
					self.filterYearly();
					
					dom.classList.remove('wait');
				}, (error) =>
				{
					dom.classList.remove('wait');
					Notify.error(Translator.get('fetch.error'));
				});
			},
			
			filterYearly: function()
			{
				var self = this;
				var dom = this.dom.querySelector('#yearly');
				
				var metric = dom.querySelector('input[type="radio"]:checked').value + "_time";
				
				var ingress = [];
				var egress = [];
				
				var end = new Date(new Date().getFullYear()+1, 0, 1);
				var datasets = [...dom.querySelectorAll('input[type="checkbox"]:checked')].map((i) =>
				{
					const data = [];
					for( var t = new Date(new Date().getFullYear(), 0, 1); t < end; t.setDate(t.getDate() + 1))
					{
						var d = self.data_yearly['m' + ('0' + (t.getMonth()+1)).substr(-2) + 'd' + ('0' + t.getDate()).substr(-2)] || {threads: {}, network: {}};

						var r = d.network.read || null;
						if( !r ) ingress.push(r);
						else ingress.push(parseInt(r.avg)/1024/1024);

						var w = d.network.write || null;
						if( !w ) egress.push(w);
						else egress.push(parseInt(w.avg)/1024/1024);
						
						d = d.threads[i.value] || null;
						if( !d ) { data.push(null); continue; }
						d = parseInt(d[metric].avg);
						if( d < 0 ) { data.push(null); continue; }
						data.push(Math.min(100, d/100000000));
					}
					
					return { label: i.nextSibling.textContent, data: data, borderColor: i.dataset.color, yAxisID: 'y'};
				});
				
				datasets.push({ label: "Network Ingress", data: ingress, borderColor: "#FB8136", yAxisID: 'y1'});
				datasets.push({ label: "Network Egress", data: egress, borderColor: "#36B0FB", yAxisID: 'y1'});
				
				self.graph_yearly.data.datasets = datasets;
				self.graph_yearly.update();
			}
		});
		
		ok(page);
	}, (e) => { nok(e); });
});

export { x as default };