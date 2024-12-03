
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
				document.body.querySelectorAll('nav li').forEach(e => { if( e.dataset.link == 'storage') e.classList.add('selected'); else e.classList.remove('selected'); });
				
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
					self.storages.sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));
					
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
										Node.span({className: 'value'}, Node.a({href: '#home?entity=' + s.id}, ae.safeHtml(s.id)))
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
					self.databases.sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));
					
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
										Node.span({className: 'value'}, Node.a({href: '#home?entity=' + db.id}, ae.safeHtml(db.id)))
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
				Modal.confirm(Translator.get('storage.remove.' + type + '.confirm', ae.safeHtml(item.name)), [Translator.get('remove'), Translator.get('cancel')]).then((index) =>
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
			
			browse: function(id, path)
			{
				var self = this;
				if( !path ) path= '/';
				
				var div = document.querySelector('#storageBrowser');
				if( !div )
				{
					div = Node.div({id: 'storageBrowser',
						drop: function(e)
						{
							e.preventDefault();
							if( !e.dataTransfer.items ) return;
							var list = [];
							[...e.dataTransfer.items].forEach((item, i) => {
								if( item.kind != "file" ) return;
								const file = item.getAsFile();
								if( !file ) return;
								
								var form = new FormData();
								form.append('path', div.dataset.path);
								form.append('file', file);
								
								list.push(Ajax.post('/api/admin/storage/' + encodeURIComponent(id) + '/file', {data: form}));
							});
							
							div.classList.add('wait');
							Promise.all(list).then(() =>
							{
								Notify.success(Translator.get('storage.upload.item.success'));
								self.browse(id, div.dataset.path);
							}, () =>
							{
								Notify.error(Translator.get('storage.upload.item.error'));
								div.classList.remove('wait');
							});
						},
						dragover: function(e)
						{
							e.preventDefault();
						}},
					[
						Node.div({className: 'addressBar'},
						[
							Node.span({className: 'icon', click: function() 
							{
								var parts = this.nextSibling.textContent.split('/');
								parts.pop();
								parts.pop();
								parts.push('');
								self.browse(id, parts.join('/'));
							}}, 'arrow_upward'),
							Node.p(ae.safeHtml(path))
						]),
						Node.ol({tabIndex: -1, 
							click: function(e)
							{
								this.focus();
								if( e.target.nodeName != 'LI' ) return;
								var s = this.querySelector('li.selected');
								if( s ) s.classList.remove('selected');
								e.target.classList.add('selected');
							},
							dblclick: function(e)
							{
								e.preventDefault();
								if( e.target.nodeName != 'LI' ) return;
								if( e.target.classList.contains('folder') ) { self.browse(id, e.target.dataset.path); return; }
								else
								{
									var name = e.target.dataset.path.split('/').pop();
									div.classList.add('wait');
									Ajax.get('/api/admin/storage/' + encodeURIComponent(id) + '/file', {data: {path: e.target.dataset.path}, responseType: 'blob'}).then((response) =>
									{
										div.classList.remove('wait');
										Node.a({href: URL.createObjectURL(response.response), download: name, target: '_blank'}).click();
									}, (error) =>
									{
										Notify.error(Translator.get('storage.download.item.error'))
										div.classList.remove('wait');
									});
								}
							},
							keydown: function(e)
							{
								var s = this.querySelector('li.selected');
								if( !s ) return;
								
								if( e.key == "Enter" )
								{
									if( s.classList.contains('folder') ) { self.browse(id, s.dataset.path); return; }
									else
									{
										var name = s.dataset.path.split('/').pop();
										div.classList.add('wait');
										Ajax.get('/api/admin/storage/' + encodeURIComponent(id) + '/file', {data: {path: s.dataset.path}, responseType: 'blob'}).then((response) =>
										{
											div.classList.remove('wait');
											Node.a({href: URL.createObjectURL(response.response), download: name, target: '_blank'}).click();
										}, (error) =>
										{
											Notify.error(Translator.get('storage.download.item.error'));
											div.classList.remove('wait');
										});
									}
								}
								else if( e.key == "Delete" )
								{
									Modal.confirm(Translator.get('storage.remove.item.confirm', ae.safeHtml(s.dataset.path)), [Translator.get('remove'), Translator.get('cancel')]).then((index) =>
									{
										if( index > 0 ) return;
										div.classList.add('wait');
										Ajax.delete('/api/admin/storage/' + encodeURIComponent(id) + '/file', {data: {path: s.dataset.path}}).then(() =>
										{
											Notify.success(Translator.get('config.remove.ok'));
											self.browse(id, div.dataset.path);
										}, (error) =>
										{
											Notify.error(Translator.get('config.remove.error'));
											div.classList.remove('wait');
										});
									}, () => {});
								}
								else if( e.key == "Backspace" )
								{
									var parts = div.dataset.path.split('/');
									parts.pop();
									parts.pop();
									parts.push('');
									self.browse(id, parts.join('/'));
								}
								else if( e.key == "ArrowLeft" )
								{
									if( s.previousSibling )
									{
										s.classList.remove('selected');
										s.previousSibling.classList.add('selected');
										s.previousSibling.scrollIntoView({block: "nearest"});
									}
								}
								else if( e.key == "ArrowRight" )
								{
									if( s.nextSibling )
									{
										s.classList.remove('selected');
										s.nextSibling.classList.add('selected');
										s.nextSibling.scrollIntoView({block: "nearest"});
									}
								}
								else if( e.key == "ArrowDown" )
								{
									if( !s.nextSibling ) return;
									for( var c = s; c; c = c.nextSibling )
									{
										if( c.offsetTop == s.offsetTop ) continue;
										if( c.offsetLeft == s.offsetLeft )
										{
											s.classList.remove('selected');
											c.classList.add('selected');
											c.scrollIntoView({block: "nearest"});
											return;
										}
									}
								}
								else if( e.key == "ArrowUp" )
								{
									if( !s.previousSibling ) return;
									for( var c = s; c; c = c.previousSibling )
									{
										if( c.offsetTop == s.offsetTop ) continue;
										if( c.offsetLeft == s.offsetLeft )
										{
											s.classList.remove('selected');
											c.classList.add('selected');
											c.scrollIntoView({block: "nearest"});
											return;
										}
									}
								}
								else if( (e.key >= 'a' && e.key <= 'z') || (e.key >= 'A' && e.key <= 'Z') || (e.key >= '0' && e.key <= '9') )
								{
									for( var i = 0; i < this.children.length; i++ )
									{
										var c = this.children[i];
										if( c.textContent[0] == e.key.toUpperCase() || c.textContent[0] == e.key.toLowerCase() )
										{
											s.classList.remove('selected');
											c.classList.add('selected');
											c.scrollIntoView({block: "nearest"});
											return;
										}
									}
								}
							}})
					]);
					Modal.custom(div, true);
				}
				
				div.classList.add('wait');
				div.dataset.path = path;
				
				Ajax.get('/api/admin/storage/' + encodeURIComponent(id), {data: {path: path}}).then((result) =>
				{
					result.response.sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
					
					var ol = div.lastChild;
					var address = div.firstChild.lastChild;
					
					address.textContent = path;
					while( ol.firstChild ) ol.firstChild.remove();
					
					result.response.filter(p => p.endsWith('/')).forEach(p =>
					{
						ol.append(Node.li({className: 'folder', title: p, dataset: {path: path + p}}, ae.safeHtml(p.slice(0, -1))));
					});
					
					result.response.filter(p => !p.endsWith('/')).forEach(p =>
					{
						ol.append(Node.li({className: 'file', title: p, dataset: {path: path + p}}, ae.safeHtml(p)));
					});
					
					if( ol.firstChild ) ol.firstChild.classList.add('selected');
					setTimeout(() => ol.focus(), 1);
					
					div.classList.remove('wait');
				}, (error) =>
				{
					Notify.error(Translator.get('storage.browse.error'));
					div.classList.remove('wait');
				});
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