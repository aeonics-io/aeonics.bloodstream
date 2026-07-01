import { Page, Node, Ajax, Translator, Notify, Modal } from 'core';
import { css, safeHtml } from 'core';
css('page.metrics');

class MetricsPage extends Page
{
	async show()
	{
		this.dom.classList.add('metrics');
		document.body.querySelectorAll('nav li').forEach(e => { if( e.dataset.link == 'metrics') e.classList.add('selected'); else e.classList.remove('selected'); });

		this.init();
		return Promise.resolve();
	}

	async hide()
	{
		if( this.ws )
		{
			this.ws.close();
			this.ws = null;
		}
		if( this.__countdown )
		{
			clearInterval(this.__countdown);
			this.__countdown = null;
		}
		this.data = {};
		this.__from = this.__until = null;

		while(this.dom.firstChild) this.dom.firstChild.remove();
		return Promise.resolve();
	}

	init()
	{
		var self = this;

		while(this.dom.firstChild) this.dom.firstChild.remove();

		this.dom.append(
			Node.h1(Translator.get('metrics.title')),
			Node.p(Translator.get('metrics.explain')),
			Node.p([
				Node.span(Translator.get('metrics.status')),
				Node.span({className: 'metrics_status disconnected'}, Translator.get('metrics.status.disconnected')),
				Node.div([
					Node.span(Translator.get('metrics.time')),
					Node.span({className: 'metrics_time'})
				])
			]),
			Node.div({className: 'action'},
			[
				Node.button({className: 'raised', click: () => { self.play(); }}, [
					Node.span({className: 'icon'}, 'play_arrow'),
					Node.span(Translator.get('metrics.start'))]),
				Node.button({className: 'raised', click: () =>
				{
					self.stop();
					Modal.confirm(Translator.get('metrics.keep_active'), [Translator.get('yes'), Translator.get('no')]).then((index) =>
					{
						if( index > 0 ) return;

						Ajax.post('/api/admin/config/aeonics.manager.monitor/enabled', {data: {value: 'false'}}).then(() =>
						{
							Notify.success(Translator.get('metrics.keep_active.success'));
						}, () =>
						{
							Notify.error(Translator.get('metrics.keep_active.error'));
						});
					});
				}}, [
					Node.span({className: 'icon'}, 'stop'),
					Node.span(Translator.get('metrics.stop'))])
			]),
			Node.ul({className: 'metrics_list'}),
			Node.div({className: 'metrics_table'}, Node.table(
			[
				Node.thead(Node.tr([
					Node.td(Translator.get('metrics.table.category')),
					Node.td(Translator.get('metrics.table.type')),
					Node.td(Translator.get('metrics.table.id')),
					Node.td(Translator.get('metrics.table.metric')),
				])),
				Node.tbody()
			]))
		);
	}

	play()
	{
		var self = this;
		this.stop();

		var list = this.dom.querySelector('.metrics_list');
		list.classList.add('wait');
		while( list.firstChild ) list.firstChild.remove();
		this.data = {};

		Promise.all([
			Ajax.get('/api/meta/monitoring'),
			Ajax.get('/api/admin/config/aeonics.manager.monitor/window'),
			Ajax.post('/api/admin/config/aeonics.manager.monitor/enabled', {data: {value: 'true'}})
		]).then((results) =>
		{
			var firstResult = JSON.stringify(results[0].response);
			self.timeWindow = results[1].response;
			list.classList.remove('wait');

			self.ws = new WebSocket(location.protocol.replace(/^http/i, "ws") + "//" + location.host +
				"/api/ws?subscribe=10000000-2000000000000000&output=metrics&filter=metrics",
				[Ajax.authorization.replace(/^Bearer /i, '')]);

			self.ws.addEventListener('open', () =>
			{
				var state = self.dom.querySelector('.metrics_status');
				state.classList.remove('disconnected');
				state.classList.add('connected');
				state.textContent = Translator.get('metrics.status.connected');

				Notify.success(Translator.get('metrics.ws.success'));

				self.dataHandler(firstResult);
			});

			self.ws.addEventListener('close', () =>
			{
				self.ws = null;

				var state = self.dom.querySelector('.metrics_status');
				if( !state ) return;
				state.classList.remove('connected');
				state.classList.add('disconnected');
				state.textContent = Translator.get('metrics.status.disconnected');
			});

			self.ws.addEventListener('message', (m) => { self.dataHandler(m.data); });

			self.ws.addEventListener('error', (e) =>
			{
				Notify.error(Translator.get('metrics.ws.disconnect'));
				self.ws.close();
				self.ws = null;

				var state = self.dom.querySelector('.metrics_status');
				state.classList.remove('connected');
				state.classList.add('disconnected');
				state.textContent = Translator.get('metrics.status.disconnected');
			});
		}, (error) =>
		{
			list.classList.remove('wait');
			Notify.error(Translator.get('fetch.error'));
		});
	}

	stop()
	{
		if( this.ws )
		{
			this.ws.close();
			this.ws = null;
			Notify.info(Translator.get('metrics.ws.disconnect'));
		}
		if( this.__countdown )
		{
			clearInterval(this.__countdown);
			this.__countdown = null;
		}
		this.data = {};
		this.__from = this.__until = null;
	}

	dataHandler(data)
	{
		var self = this;

		if( !this.__countdown )
			this.__countdown = setInterval(function() { self.countdown(); }, 1000);

		data = JSON.parse(data);
		if( !data._from )
		{
			// special case : no data (yet)
			this.dom.querySelector('.metrics_list').append(Node.p(Translator.get('metrics.nodata')));
			this.__until = new Date().getTime();
			this.countdown();
			return;
		}

		if( !this.__origin ) this.__origin = data._from;
		if( !this.__until ) this.__until = data._to;
		else if( data._to <= this.__until ) return;
		this.__until = data._to;
		this.countdown();

		var thead = this.dom.querySelector('.metrics_table thead tr');
		thead.append(Node.td(
			new Date(data._from).toLocaleString([], {timeStyle: 'medium'}) + " - " +
			new Date(data._to).toLocaleString([], {timeStyle: 'medium'})
		));
		var tbody = this.dom.querySelector('.metrics_table tbody');

		Object.entries(data).forEach(([category, l1]) =>
		{
			if( category == '_from' || category == '_to' ) return;

			if( !self.data.hasOwnProperty(category) )
				self.data[category] = {};

			Object.entries(l1).forEach(([type, l2]) =>
			{
				Object.entries(l2).forEach(([id, l3]) =>
				{
					Object.entries(l3).forEach(([metric, l4]) =>
					{
						if( !self.data[category].hasOwnProperty(metric) )
							self.data[category][metric] = l4;
						else
						{
							self.data[category][metric]._count += l4._count;
							self.data[category][metric]._total += l4._total;
						}

						var uuid = category+'|'+type+'|'+id+'|'+metric;
						var tr = [...tbody.children].find(x => x.dataset.uuid == uuid);
						if( !tr )
						{
							tr = Node.tr({dataset: {uuid: uuid}}, [
								Node.td(safeHtml(category)),
								Node.td(safeHtml(type)),
								Node.td(Node.a({href: '#home?entity=' + id}, safeHtml(id))),
								Node.td({className: 'centered'}, safeHtml(metric))
							]);
							for( var i = thead.children.length-tr.children.length-1; i > 0; i-- )
								tr.append(Node.td());
							tbody.append(tr);
						}

						if( l4._total === 0 )
						{
							tr.append(Node.td({className: 'centered'},
								parseInt(l4._count) + '&times;' + ' (' +
								self.getCountByTime(l4._count, Math.ceil((data._to - data._from) / 1000)) + ')'
							));
						}
						else
						{
							tr.append(Node.td({className: 'centered'},
								self.getRate(l4._total, l4._count) + ' (' +
								parseInt(l4._count) + '&times;' + ')'
							));
						}
					});
				});
			});
		});


		// add missing td to rows
		[...tbody.children].forEach(tr =>
		{
			while( tr.children.length < thead.children.length )
				tr.append(Node.td());
		});

		var list = this.dom.querySelector('.metrics_list');
		if( !list ) return;

		while( list.firstChild ) list.firstChild.remove();

		var elapsed = Math.ceil((this.__until - this.__origin) / 1000);

		[...Object.entries(self.data)].sort((a, b) => { return a[0] > b[0] ? 1 : -1; }).forEach(([key, metrics]) =>
		{
			list.appendChild(Node.li([
				Node.p(safeHtml(key)),
				[...Object.entries(metrics)].sort((a, b) => { return a[0] > b[0] ? 1 : -1; }).map(([metric, value]) =>
				{
					if( value._total == 0 )
					{
						return Node.div({className: 'counter'}, [
							Node.p(safeHtml(metric)),
							Node.span(parseInt(value._count)+'&times;'),
							Node.span(self.getCountByTime(value._count, elapsed))
						]);
					}
					else
					{
						return Node.div({className: 'timer'}, [
							Node.p(safeHtml(metric)),
							Node.span(self.getRate(value._total, value._count)),
							Node.span(parseInt(value._count)+'&times;')
						]);
					}
				})
			]));
		});
	}

	getCountByTime(count, seconds)
	{
		// convert time to milliseconds
		time = seconds * 1000;
		if( (count / time) >= 1 )
			return (Math.round((count / time) * 10) / 10) + "/ms";

		// convert time to seconds
		time = seconds;
		if( (count / time) >= 1 )
			return (Math.round((count / time) * 10) / 10) + "/s";

		// convert time to minutes
		time = seconds / 60;
		if( (count / time) >= 1 )
			return (Math.round((count / time) * 10) / 10) + "/min";

		// convert time to hours
		var time = seconds / 3600;
		return (Math.round((count / time) * 10) / 10) + "/h";
	}

	getRate(total, count)
	{
		var ratio = total / count;

		if( ratio < 1000 ) return "~" + (Math.round(ratio * 10) / 10);
		ratio /= 1000;
		if( ratio < 1000 ) return "~" + (Math.round(ratio * 10) / 10) + "k";
		ratio /= 1000;
		if( ratio < 1000 ) return "~" + (Math.round(ratio * 10) / 10) + "M";
		ratio /= 1000;
		if( ratio < 1000 ) return "~" + (Math.round(ratio * 10) / 10) + "B";
		ratio /= 1000;
		return "~" + (Math.round(ratio * 10) / 10) + "T";
	}

	countdown()
	{
		if( !this.__until ) return;

		var left = Math.ceil(Math.max(0, (this.timeWindow - (new Date().getTime() - this.__until)) / 1000));
		this.dom.querySelector('.metrics_time').textContent = Translator.get('metrics.time.left', ''+left);
	}
}

const page = new MetricsPage();
export { page as default };
