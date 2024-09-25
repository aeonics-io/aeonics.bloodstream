
let ae = globalThis.ae;
var x = new Promise((ok, nok) =>
{
	ae.require('Page', 'Node', 'Ajax', 'Translator', 'Notify', 'Modal', 'Entity', 'page.storage.css', 'ext/prism.js', 'ext/code-input.min.js', 'ext/code-input.min.css', 'ext/prism.css').then(([Page, Node, Ajax, Translator, Notify, Modal, Entity]) =>
	{
		var page = new Page();
		Object.assign(page, 
		{
			show: function()
			{
				this.dom.classList.add('storage');
				
				this.init();
				return Promise.resolve();
			},
			
			hide: function()
			{
				while(this.dom.firstChild) this.dom.firstChild.remove();
				delete this.storages;
				delete this.databases;
				
				return Promise.resolve(); 
			},
			
			init: function()
			{
				var self = this;
				codeInput.registerTemplate("syntax-highlighted", codeInput.templates.prism(Prism));
				
				this.dom.classList.add('wait');
				while(this.dom.firstChild) this.dom.firstChild.remove();
				
				this.dom.append(
					Node.div({className: 'search'}, [
						Node.input({type: 'search', input: function()
						{
							self.filter(this.value);
						}}),
						Node.span({className: 'icon'}, 'search')
					]),
					Node.h1(Translator.get('storage.title')),
					Node.p(Translator.get('storage.explain')),
					Node.div({className: 'tab', dataset: {tab: 1}}, [
						Node.div({click: function(e) { self.switchTab(e.target); }}, [
							Node.span(Translator.get('storage.storage')),
							Node.span(Translator.get('storage.database'))
						]),
						Node.div([
							Node.div({className: 'tabcontent', id: 'storage_tab_storage'}),
							Node.div({className: 'tabcontent', id: 'storage_tab_database'})
						])
					])
				);
				
				this.refresh();
			},
			
			switchTab: function(node)
			{
				if( node.nodeName !== 'SPAN' ) return;
				
				var index = Array.prototype.indexOf.call(node.parentNode.childNodes, node) + 1;
				var t = node.parentNode.parentNode;
				t.dataset.tab = index;
				t.classList.toggle('changed');
			},
			
			filter: function(value)
			{
				var words = (value||'').split(/\s+/g).map(w => new RegExp((w||'').replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'), 'i'));
				
				[].slice.call(this.dom.querySelectorAll('.tab .tabcontent h2')).forEach(p =>
				{
					if( !value || value.length == 0 ) { p.parentNode.classList.remove('hidden'); return; }
					
					for (var w = 0; w < words.length; w++)
					{
						if( !words[w].test(p.textContent) )
						{
							p.parentNode.classList.add('hidden');
							return;
						}
					}
					p.parentNode.classList.remove('hidden');
				});
			},
			
			refresh: function()
			{
				var self = this;
				var div_storage = this.dom.querySelector('#storage_tab_storage');
				while(div_storage.firstChild) div_storage.firstChild.remove();
				
				var div_database = this.dom.querySelector('#storage_tab_database');
				while(div_database.firstChild) div_database.firstChild.remove();
				
				this.dom.classList.add('wait');
				Promise.all([
					Ajax.get('/api/meta/registry/aeonics.entity.storage/entities'),
					Ajax.get('/api/meta/registry/aeonics.entity.database/entities')
				]).then((results) =>
				{
					self.storages = results[0].response;
					self.storages.sort((a, b) => { return a.name > b.name ? 1 : -1; });
					
					div_storage.append(
						Node.div({className: 'action'}, Node.button({className: 'raised', click: function(e)
						{
							e.preventDefault();
							Entity.create('aeonics.entity.storage').then(() => self.refresh(), () => {});
						}}, 
						[
							Node.span({className: 'icon'}, 'create'),
							Translator.get('create')
						])),
						Node.ul(
							self.storages.map(s => Node.li({dataset: {id: s.id}}, [
								Node.h2([
									Node.span(ae.safeHtml(s.name)),
									Node.div({className: 'actions'},
									[
										Node.span({click: function() { self.remove(this.closest('li').dataset.id, 'storage'); }, title: Translator.get('remove')}, 'close'),
										Node.span({click: function() { self.edit(this.closest('li').dataset.id, 'storage'); }, title: Translator.get('edit')}, 'edit'),
										Node.span({click: function() { self.browse(this.closest('li').dataset.id); }, title: Translator.get('browse')}, 'folder_open')
									])
								]),
								Node.div(Node.div({className: 'detail'}, [
									Node.p([
										Node.span({className: 'title'}, Translator.get('info.entity.id')),
										Node.span({className: 'value'}, ae.safeHtml(s.id))
									]),
									Node.p([
										Node.span({className: 'title'}, Translator.get('info.entity.type')),
										Node.span({className: 'value'}, ae.safeHtml(s.type))
									]),
									Node.p([
										Node.span({className: 'title'}, Translator.get('info.entity.class')),
										Node.span({className: 'value'}, ae.safeHtml(s.class))
									])
								]))
							]))
						)
					);
					
					self.databases = results[1].response;
					self.databases.sort((a, b) => { return a.name > b.name ? 1 : -1; });
					
					div_database.append(
						Node.div({className: 'action'}, Node.button({className: 'raised', click: function(e)
						{
							e.preventDefault();
							Entity.create('aeonics.entity.database').then(() => self.refresh(), () => {});
						}}, 
						[
							Node.span({className: 'icon'}, 'create'),
							Translator.get('create')
						])),Node.ul(
							self.databases.map(db => Node.li({dataset: {id: db.id}}, [
								Node.h2([
									Node.span(ae.safeHtml(db.name)),
									Node.div({className: 'actions'},
									[
										Node.span({click: function() { self.remove(this.closest('li').dataset.id, 'database'); }, title: Translator.get('remove')}, 'close'),
										Node.span({click: function() { self.edit(this.closest('li').dataset.id, 'database'); }, title: Translator.get('edit')}, 'edit'),
										Node.span({click: function() { self.query(this.closest('li').dataset.id); }, title: Translator.get('query')}, 'database')
									])
								]),
								Node.div(Node.div({className: 'detail'}, [
									Node.p([
										Node.span({className: 'title'}, Translator.get('info.entity.id')),
										Node.span({className: 'value'}, ae.safeHtml(db.id))
									]),
									Node.p([
										Node.span({className: 'title'}, Translator.get('info.entity.type')),
										Node.span({className: 'value'}, ae.safeHtml(db.type))
									]),
									Node.p([
										Node.span({className: 'title'}, Translator.get('info.entity.class')),
										Node.span({className: 'value'}, ae.safeHtml(db.class))
									])
								]))
							]))
						)
					);
					
					self.dom.classList.remove('wait');
				}, (error) =>
				{
					Notify.error(Translator.get('fetch.error'));
				});
			},
			
			remove: function(id, type)
			{
				var item = (type=='storage'?this.storages:this.databases).find(x => x.id == id);
				if( !item )
				{
					Notify.error(Translator.get('storage.remove.' + type + '.error'));
					return;
				}
				
				var self = this;
				Modal.confirm(Translator.get('storage.remove.' + type + '.confirm', item.name), [Translator.get('remove'), Translator.get('cancel')]).then((index) =>
				{
					if( index > 0 ) return;
					
					self.dom.classList.add('wait');
					Ajax.delete('/api/meta/entity/' + encodeURIComponent(item.category) + '/' + encodeURIComponent(item.id)).then(() =>
					{
						Notify.success(Translator.get('storage.remove.' + type + '.success'));
						self.refresh();
					}, (error) =>
					{
						Notify.error(Translator.get('storage.remove.' + type + '.error'));
						self.dom.classList.remove('wait');
					});
				}, () => {});
			},
			
			edit: function(id, type)
			{
				var item = (type=='storage'?this.storages:this.databases).find(x => x.id == id);
				if( !item )
				{
					Notify.error(Translator.get('storage.edit.' + type + '.error'));
					return;
				}
				
				var self = this;
				Entity.edit(item).then(() => self.refresh(), () => {});
			},
			
			browse: function(id)
			{
			},
			
			query: function(id)
			{
				Modal.custom(
				[
					Node.p(Translator.get('storage.query')),
					Node.create('code-input', {id: 'sql', lang: "SQL", value: 'SELECT * \nFROM [table]\nWHERE 1 = 1;', 'line-numbers': true}),
					Node.button({click: function(e)
					{
						e.preventDefault();
						
						var now = new Date().getTime();
						Ajax.get('/api/admin/database/' + encodeURIComponent(id) + '/query', {data: {sql: this.previousSibling.value}}).then((result) =>
						{
							var roundtrip = new Date().getTime() - now;
							var ms = null;
							if( result.headers.hasOwnProperty('x-ns-process') )
								ms = Math.round((parseInt(result.headers['x-ns-process'])/100000))/10 + "ms";
							else
								ms = "-";
							
							Modal.alert(Node.div({className: 'queryResult'},
							[
								Node.div({className: 'group'}, [
									Node.p([
										Node.span({className: 'title'}, Translator.get('endpoints.result.status')),
										Node.span({className: 'text'}, ae.safeHtml(""+result.status))
									]),
									Node.p([
										Node.span({className: 'title'}, Translator.get('endpoints.result.roundtrip')),
										Node.span({className: 'value'}, roundtrip + "ms")
									]),
									Node.p([
										Node.span({className: 'title'}, Translator.get('endpoints.result.processing')),
										Node.span({className: 'value'}, ms)
									]),
									Node.pre({className: 'response'}, Node.code({id: 'endpoint_response', className: "language-json"}, JSON.stringify(result.response, null, 4)))
								])
							]));
							Prism.highlightElement(document.getElementById('endpoint_response'));
						}, (error) =>
						{
							var roundtrip = new Date().getTime() - now;
							var ms = null;
							if( error.headers.hasOwnProperty('x-ns-process') )
								ms = Math.round((parseInt(error.headers['x-ns-process'])/100000))/10 + "ms";
							else
								ms = "-";
							
							Modal.alert(Node.div({className: 'queryResult'},
							[
								Node.div({className: 'group'}, [
									Node.p([
										Node.span({className: 'title'}, Translator.get('endpoints.result.status')),
										Node.span({className: 'text'}, ae.safeHtml(""+error.status))
									]),
									Node.p([
										Node.span({className: 'title'}, Translator.get('endpoints.result.roundtrip')),
										Node.span({className: 'value'}, roundtrip + "ms")
									]),
									Node.p([
										Node.span({className: 'title'}, Translator.get('endpoints.result.processing')),
										Node.span({className: 'value'}, ms)
									]),
									Node.pre({className: 'response'}, Node.code({id: 'endpoint_response', className: "language-json"}, JSON.stringify(error.response, null, 4)))
								])
							]));
							Prism.highlightElement(document.getElementById('endpoint_response'));
						});
					}}, Translator.get('query'))
				], true);
			}
		});
		
		ok(page);
	}, (e) => { nok(e); });
});

export { x as default };