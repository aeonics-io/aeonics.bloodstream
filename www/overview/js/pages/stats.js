
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
						Node.li({id: 'fact_hourly'}),
						Node.li({id: 'fact_daily'}),
						Node.li({id: 'fact_yearly'}),
						Node.li({id: 'fact_uptime'}),
						Node.li({id: 'fact_memoryheap'}),
						Node.li({id: 'fact_memorynonheap'}),
						Node.li({id: 'fact_memorycommitted'}),
						Node.li({id: 'fact_tasks'}),
						Node.li({id: 'fact_pending'})
					]))
				);
				
				this.initHourly();
				this.initDaily();
				this.initYearly();
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
					self.dom.querySelector('#fact_uptime').innerHTML = Translator.get('stats.fact.uptime', hrs, mins, secs);
					
					var pending = result.response.system.tasks.normal.pending + result.response.system.tasks.background.pending + result.response.system.tasks.priority.pending;
					var tasks = (result.response.system.tasks.normal.submitted + result.response.system.tasks.background.submitted + result.response.system.tasks.priority.submitted) - pending;
					self.dom.querySelector('#fact_pending').innerHTML = Translator.get('stats.fact.pending', pending);
					self.dom.querySelector('#fact_tasks').innerHTML = Translator.get('stats.fact.tasks', tasks);
					
					self.dom.querySelector('#fact_memoryheap').innerHTML = Translator.get('stats.fact.memoryheap', Math.round(result.response.ram.heap.used / (1024*1024)));
					self.dom.querySelector('#fact_memorynonheap').innerHTML = Translator.get('stats.fact.memorynonheap', Math.round(result.response.ram.nonheap.used / (1024*1024)));
					self.dom.querySelector('#fact_memorycommitted').innerHTML = Translator.get('stats.fact.memorycommitted', Math.round(result.response.ram.physical.process / (1024*1024)));
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
						for( const [key, value] of Object.entries(m) )
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
							maintainAspectRatio: false,
							resizeDelay: 250,
							scales: {
								x: {
									title: { 
										text: 'Time',
										display: true
									},
									ticks: {
										display: true,
									}
								},
								y: {
									title: {text: '% Time', display: true},
									type: 'linear',
									min: 0, max: 100
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
				
				this.initSystem();
			},
			
			filterHourly: function()
			{
				var self = this;
				var dom = this.dom.querySelector('#hourly');
				
				var metric = dom.querySelector('input[type="radio"]:checked').value + "_time";
				
				var datasets = [...dom.querySelectorAll('input[type="checkbox"]:checked')].map((i) =>
				{
					const data = [];
					for( var m = 0; m < 60; m++ )
					{
						for( var s = 0; s < 6; s++ )
						{
							var d = self.data_hourly['m' + ('0' + m).substr(-2) + 's' + s + '0'] || {};
							d = d[i.value] || null;
							if( !d ) { data.push(null); continue; }
							d = parseInt(d[metric]);
							if( d < 0 ) { data.push(null); continue; }
							data.push(Math.min(100, d/100000000));
						}
					}
					
					return { label: i.nextSibling.textContent, data: data, borderColor: i.dataset.color};
				});
				
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
						for( const [key, value] of Object.entries(m) )
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
							maintainAspectRatio: false,
							resizeDelay: 250,
							scales: {
								x: {
									title: { 
										text: 'Time',
										display: true
									},
									ticks: {
										display: true,
									}
								},
								y: {
									title: {text: '% Time', display: true},
									type: 'linear',
									min: 0, max: 100
								}
							}
						}
					});
					
					// filter
					self.filterDaily();
					
					// facts
					self.dom.querySelector('#fact_daily').innerHTML = Translator.get('stats.fact.daily', Math.round(sum / 1000000000));
					
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
				
				var datasets = [...dom.querySelectorAll('input[type="checkbox"]:checked')].map((i) =>
				{
					const data = [];
					for( var h = 0; h < 24; h++ )
					{
						var d = self.data_daily['h' + ('0' + h).substr(-2)] || {};
						d = d[i.value] || null;
						if( !d ) { data.push(null); continue; }
						d = parseInt(d[metric].avg);
						if( d < 0 ) { data.push(null); continue; }
						data.push(Math.min(100, d/100000000));
					}
					
					return { label: i.nextSibling.textContent, data: data, borderColor: i.dataset.color};
				});
				
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
						for( const [key, value] of Object.entries(m) )
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
							resizeDelay: 250,
							scales: {
								x: {
									title: { 
										text: 'Time',
										display: true
									},
									ticks: {
										display: true,
									}
								},
								y: {
									title: {text: '% Time', display: true},
									type: 'linear',
									min: 0, max: 100
								}
							}
						}
					});
					
					// filter
					self.filterYearly();
					
					// facts
					self.dom.querySelector('#fact_yearly').innerHTML = Translator.get('stats.fact.yearly', Math.round(sum / 3600000000000));
					
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
				
				var end = new Date(new Date().getFullYear()+1, 0, 1);
				var datasets = [...dom.querySelectorAll('input[type="checkbox"]:checked')].map((i) =>
				{
					const data = [];
					for( var t = new Date(new Date().getFullYear(), 0, 1); t < end; t.setDate(t.getDate() + 1))
					{
						var d = self.data_yearly['m' + ('0' + (t.getMonth()+1)).substr(-2) + 'd' + ('0' + t.getDate()).substr(-2)] || {};
						d = d[i.value] || null;
						if( !d ) { data.push(null); continue; }
						d = parseInt(d[metric].avg);
						if( d < 0 ) { data.push(null); continue; }
						data.push(Math.min(100, d/100000000));
					}
					
					return { label: i.nextSibling.textContent, data: data, borderColor: i.dataset.color};
				});
				
				self.graph_yearly.data.datasets = datasets;
				self.graph_yearly.update();
			}
		});
		
		ok(page);
	}, (e) => { nok(e); });
});

export { x as default };