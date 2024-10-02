
let ae = globalThis.ae;
var x = new Promise((ok, nok) =>
{
	ae.require('Page', 'Node', 'Ajax', 'Translator', 'Notify', 'Modal', 'page.logs.css').then(([Page, Node, Ajax, Translator, Notify, Modal]) =>
	{
		var page = new Page();
		Object.assign(page, 
		{
			show: function()
			{
				this.dom.classList.add('logs');
				
				this.init();
				
				var self = this;
				return Ajax.get('/api/admin/config/aeonics.manager.logger/level').then((response) =>
				{
					self._level = parseInt(response.response);
				}, (error) =>
				{
					self._level = 700;
				});
			},
			
			hide: function()
			{
				if( this.ws )
				{
					this.ws.close();
					this.ws = null;
				}
				
				while(this.dom.firstChild) this.dom.firstChild.remove();
				return Promise.resolve(); 
			},
			
			init: function()
			{
				var self = this;
				while(this.dom.firstChild) this.dom.firstChild.remove();
				
				this.dom.append(
					Node.h1(Translator.get('logs.title')),
					Node.p(Translator.get('logs.explain')),
					Node.p([
						Node.span(Translator.get('logs.status')),
						Node.span({className: 'log_status disconnected'}, Translator.get('logs.status.disconnected'))
					]),
					Node.div({className: 'action'},
					[
						Node.button({className: 'raised', click: () => { self.play(); }}, [
							Node.span({className: 'icon'}, 'play_arrow'), 
							Node.span(Translator.get('logs.start'))]),
						Node.button({className: 'raised', click: () => { self.pause(); }}, [
							Node.span({className: 'icon'}, 'pause'), 
							Node.span(Translator.get('logs.suspend'))]),
						Node.button({className: 'raised', click: () => { self.stop(); }}, [
							Node.span({className: 'icon'}, 'stop'), 
							Node.span(Translator.get('logs.stop'))])
					]),
					Node.ul({className: 'logs_list'})
				);
			},
			
			play: function()
			{
				var self = this;
				this.pause();
				
				Modal.prompt(Translator.get('logs.choose.level'), Node.form(
				[
					Node.select({name: 'level', value: ''+this._level}, [
						Node.option({value: '1000'}, 'SEVERE'),
						Node.option({value: '900'}, 'WARNING'),
						Node.option({value: '800'}, 'INFO'),
						Node.option({value: '700'}, 'CONFIG'),
						Node.option({value: '500'}, 'FINE'),
						Node.option({value: '400'}, 'FINER'),
						Node.option({value: '300'}, 'FINEST'),
						Node.option({value: '0'}, 'ALL'),
						Node.option({value: '-1'}, 'DEBUG')
					]),
					Node.p(Translator.get('logs.choose.filter')),
					Node.input({name: 'filter', type: 'text', value: '#'})
				])).then((form) =>
				{
					if( !form.level.value ) return;
					
					self._level = form.level.value;
					
					Ajax.post('/api/admin/config/aeonics.manager.logger/level', {data: {value: form.level.value}}).then((response) =>
					{
						var list = self.dom.querySelector('.logs_list');
						if( list ) while( list.firstChild ) list.firstChild.remove();
				
						self.ws = new WebSocket(location.protocol.replace(/^http/i, "ws") + "//" + location.host + 
							"/api/ws?subscribe=log&filter=" + encodeURIComponent(form.filter.value),
							[Ajax.authorization.replace(/^Bearer /i, '')]);
							
						self.ws.addEventListener('open', () => 
						{
							var state = self.dom.querySelector('.log_status');
							state.classList.remove('disconnected');
							state.classList.add('connected');
							state.textContent = Translator.get('logs.status.connected');
								
							Notify.success(Translator.get('logs.ws.success'));
						});
						
						self.ws.addEventListener('close', () => 
						{
							self.ws = null;
							
							var state = self.dom.querySelector('.log_status');
							state.classList.remove('connected');
							state.classList.add('disconnected');
							state.textContent = Translator.get('logs.status.disconnected');
						});
						
						self.ws.addEventListener('message', (m) => { self.dataHandler(JSON.parse(m.data)); });
						
						self.ws.addEventListener('error', (e) =>
						{
							Notify.error(Translator.get('logs.ws.disconnect'));
							self.ws.close();
							self.ws = null;
							
							var state = self.dom.querySelector('.log_status');
							state.classList.remove('connected');
							state.classList.add('disconnected');
							state.textContent = Translator.get('logs.status.disconnected');
						});
					}, (error) =>
					{
						Notify.error(Translator.get('logs.set.error'));
					});
				});
			},
			
			pause: function()
			{
				if( this.ws )
				{
					this.ws.close();
					this.ws = null;
					Notify.info(Translator.get('logs.suspended'));
				}
			},
			
			stop: function()
			{
				var self = this;
				this.pause();
				
				Modal.prompt(Translator.get('logs.restore.level'), Node.form(Node.select({name: 'level', value: ''+this._level}, [
					Node.option({value: '1000'}, 'SEVERE'),
					Node.option({value: '900'}, 'WARNING'),
					Node.option({value: '800'}, 'INFO'),
					Node.option({value: '700'}, 'CONFIG'),
					Node.option({value: '500'}, 'FINE'),
					Node.option({value: '400'}, 'FINER'),
					Node.option({value: '300'}, 'FINEST'),
					Node.option({value: '0'}, 'ALL'),
					Node.option({value: '-1'}, 'DEBUG')
				]))).then((form) =>
				{
					if( !form.level.value ) return;
					
					self._level = form.level.value;
					
					Ajax.post('/api/admin/config/aeonics.manager.logger/level', {data: {value: form.level.value}}).then((response) =>
					{
						Notify.success(Translator.get('logs.restore.success'));
					}, (error) =>
					{
						Notify.error(Translator.get('logs.restore.fail'));
					});
				});
			},
			
			dataHandler: function(data)
			{
				var self = this;
				var list = this.dom.querySelector('.logs_list');
				if( !list ) return;
				
				var li = Node.li();
				
				if( data.level < 300 ) { li.appendChild(Node.span({className: 'level ALL'}, ''+data.level)); }
				else if( data.level == 300 ) { li.appendChild(Node.span({className: 'level FINEST'}, 'FINEST')); }
				else if( data.level < 300 ) { li.appendChild(Node.span({className: 'level FINEST'}, ''+data.level)); }
				else if( data.level == 400 ) { li.appendChild(Node.span({className: 'level FINER'}, 'FINER')); }
				else if( data.level < 400 ) { li.appendChild(Node.span({className: 'level FINER'}, ''+data.level)); }
				else if( data.level == 500 ) { li.appendChild(Node.span({className: 'level FINE'}, 'FINE')); }
				else if( data.level < 500 ) { li.appendChild(Node.span({className: 'level FINE'}, ''+data.level)); }
				else if( data.level == 700 ) { li.appendChild(Node.span({className: 'level CONFIG'}, 'CONFIG')); }
				else if( data.level < 700 ) { li.appendChild(Node.span({className: 'level CONFIG'}, ''+data.level)); }
				else if( data.level == 800 ) { li.appendChild(Node.span({className: 'level INFO'}, 'INFO')); }
				else if( data.level < 800 ) { li.appendChild(Node.span({className: 'level INFO'}, ''+data.level)); }
				else if( data.level == 900 ) { li.appendChild(Node.span({className: 'level WARNING'}, 'WARNING')); }
				else if( data.level < 900 ) { li.appendChild(Node.span({className: 'level WARNING'}, ''+data.level)); }
				else if( data.level == 1000 ) { li.appendChild(Node.span({className: 'level SEVERE'}, 'SEVERE')); }
				else if( data.level < 1000 ) { li.appendChild(Node.span({className: 'level SEVERE'}, ''+data.level)); }
				else { li.appendChild(Node.span({className: 'level SEVEREST'}, ''+data.level)); }
				
				li.append(
					Node.span({className: 'date'}, new Date(data.date).toLocaleString([], {timeStyle: 'medium'}) + "." + new Date(data.date).getMilliseconds()),
					Node.span({className: 'tag'}, ae.safeHtml(data.type)),
					Node.p({className: 'message'}, ae.safeHtml(data.message)),
				);
				
				while( list.children.length > 100 ) list.firstChild.remove();
				list.appendChild(li);
			}
		});
		
		ok(page);
	}, (e) => { nok(e); });
});

export { x as default };