
let ae = globalThis.ae;
var x = new Promise((ok, nok) =>
{
	ae.require('Page', 'Node', 'Ajax', 'Translator', 'Notify', 'Modal', 'page.debug.css', 'ext/prism.js', 'ext/code-input.min.js', 'ext/code-input.min.css', 'ext/prism.css').then(([Page, Node, Ajax, Translator, Notify, Modal]) =>
	{
		var page = new Page();
		Object.assign(page, 
		{
			show: function()
			{
				this.dom.classList.add('debug');
				document.body.querySelectorAll('nav li').forEach(e => { if( e.dataset.link == 'debug') e.classList.add('selected'); else e.classList.remove('selected'); });
				
				this.init();
				return Promise.resolve();
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
				codeInput.registerTemplate("syntax-highlighted", codeInput.templates.prism(Prism));
				
				while(this.dom.firstChild) this.dom.firstChild.remove();
				
				this.dom.append(
					Node.h1(Translator.get('debug.title')),
					Node.p(Translator.get('debug.explain')),
					Node.p([
						Node.span(Translator.get('debug.status')),
						Node.span({className: 'debug_status disconnected'}, Translator.get('debug.status.disconnected'))
					]),
					Node.div({className: 'action'},
					[
						Node.button({className: 'raised', click: () => { self.play(); }}, [
							Node.span({className: 'icon'}, 'play_arrow'), 
							Node.span(Translator.get('debug.start'))]),
						Node.button({className: 'raised', click: () => { self.stop(); }}, [
							Node.span({className: 'icon'}, 'stop'), 
							Node.span(Translator.get('debug.stop'))])
					]),
					Node.ul({className: 'debug_list'})
				);
			},
			
			play: function()
			{
				var self = this;
				this.stop();
				
				Modal.prompt(Translator.get('debug.choose.filter'), Node.form(
				[
					Node.input({name: 'filter', type: 'text', value: '#'})
				])).then((form) =>
				{
					var list = self.dom.querySelector('.debug_list');
					if( list ) while( list.firstChild ) list.firstChild.remove();
			
					self.ws = new WebSocket(location.protocol.replace(/^http/i, "ws") + "//" + location.host + 
						"/api/ws?subscribe=10000000-1400000000000000&output=data&filter=" + encodeURIComponent(form.filter.value),
						[Ajax.authorization.replace(/^Bearer /i, '')]);
						
					self.ws.addEventListener('open', () => 
					{
						var state = self.dom.querySelector('.debug_status');
						state.classList.remove('disconnected');
						state.classList.add('connected');
						state.textContent = Translator.get('debug.status.connected');
							
						Notify.success(Translator.get('debug.ws.success'));
					});
					
					self.ws.addEventListener('close', () => 
					{
						self.ws = null;
						
						var state = self.dom.querySelector('.debug_status');
						state.classList.remove('connected');
						state.classList.add('disconnected');
						state.textContent = Translator.get('debug.status.disconnected');
					});
					
					self.ws.addEventListener('message', (m) => { self.dataHandler(m.data); });
					
					self.ws.addEventListener('error', (e) =>
					{
						Notify.error(Translator.get('debug.ws.disconnect'));
						self.ws.close();
						self.ws = null;
						
						var state = self.dom.querySelector('.debug_status');
						state.classList.remove('connected');
						state.classList.add('disconnected');
						state.textContent = Translator.get('debug.status.disconnected');
					});
				}, () => {});
			},
			
			stop: function()
			{
				if( this.ws )
				{
					this.ws.close();
					this.ws = null;
					Notify.info(Translator.get('debug.ws.disconnect'));
				}
			},
			
			dataHandler: function(data)
			{
				var self = this;
				var list = this.dom.querySelector('.debug_list');
				if( !list ) return;
				
				var pre = Node.pre({className: 'response'}, Node.code({className: "language-json"}, JSON.stringify(JSON.parse(data), null, 4)));
				
				while( list.children.length > 100 ) list.firstChild.remove();
				list.appendChild(Node.li(pre));
				
				Prism.highlightElement(pre.firstChild);
			}
		});
		
		ok(page);
	}, (e) => { nok(e); });
});

export { x as default };