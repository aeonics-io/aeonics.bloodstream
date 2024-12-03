
let ae = globalThis.ae;
var x = new Promise((ok, nok) =>
{
	ae.require('Page', 'Node', 'Ajax', 'Translator', 'Notify', 'Modal', 'page.snapshot.css').then(([Page, Node, Ajax, Translator, Notify, Modal]) =>
	{
		var page = new Page();
		Object.assign(page, 
		{
			show: function()
			{
				this.dom.classList.add('snapshot');
				document.body.querySelectorAll('nav li').forEach(e => { if( e.dataset.link == 'snapshot') e.classList.add('selected'); else e.classList.remove('selected'); });
				
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
				while(this.dom.firstChild) this.dom.firstChild.remove();
				
				this.dom.append(
					Node.div({className: 'search'}, [
						Node.input({type: 'search', input: function()
						{
							self.filter(this.value);
						}}),
						Node.span({className: 'icon'}, 'search')
					]),
					Node.h1(Translator.get('snapshot.title')),
					Node.p(Translator.get('snapshot.explain')),
					Node.div({className: 'action'},
					[
						Node.button({className: 'raised', click: (e) => { e.preventDefault(); this.create(); }}, [
							Node.span({className: 'icon'}, 'add'), 
							Node.span(Translator.get('snapshot.create'))]),
						Node.button({className: 'raised', click: (e) => { e.preventDefault(); this.upload(); }}, [
							Node.span({className: 'icon'}, 'file_upload'), 
							Node.span(Translator.get('snapshot.upload'))])
					]),
					Node.section({id: 'snapshot_current'}),
					Node.section([
						Node.h2(Translator.get('snapshot.list')),
						Node.ol({id: 'snapshot_list'})
					])
				);
				
				this.refresh();
			},
			
			filter: function(value)
			{
				var words = (value||'').split(/\s+/g).map(w => new RegExp((w||'').replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'), 'i'));
				
				[].slice.call(this.dom.querySelectorAll('section li h3')).forEach(p =>
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
				var div = this.dom.querySelector('#snapshot_list');
				while(div.firstChild) div.firstChild.remove();
				
				var section = this.dom.querySelector('#snapshot_current');
				while(section.firstChild) section.firstChild.remove();
				
				this.dom.classList.add('wait');
				Promise.all([
					Ajax.get('/api/meta/managers'),
					Ajax.get('/api/admin/snapshot/list'),
					Ajax.get('/api/admin/snapshot/latest')
				]).then((results) =>
				{
					var current = results[0].response['aeonics.manager.snapshot'];
					var list = results[1].response.sort().reverse();
					var latest = results[2].response.name;
					
					section.append(
						Node.h2(Translator.get('snapshot.current')),
						Node.div(Node.div({className: 'detail'}, [
							Node.p([
								Node.span({className: 'title'}, Translator.get('info.entity.id')),
								Node.span({className: 'value'}, Node.a({href: '#home?entity=' + current.id}, ae.safeHtml(current.id)))
							]),
							Node.p([
								Node.span({className: 'title'}, Translator.get('info.template.type_plugin')),
								Node.span({className: 'value'}, ae.safeHtml(current.plugin))
							]),
							Node.p([
								Node.span({className: 'title'}, Translator.get('info.entity.type')),
								Node.span({className: 'value'}, ae.safeHtml(current.type))
							]),
							Node.p([
								Node.span({className: 'title'}, Translator.get('info.entity.class')),
								Node.span({className: 'value'}, ae.safeHtml(current.class))
							]),
							Node.p([
								Node.span({className: 'title'}, Translator.get('snapshot.latest')),
								Node.span({className: 'text'}, ae.safeHtml(latest))
							])
						]))
					);
					
					if( list.length == 0 ) div.append(Node.p(Translator.get('snapshot.empty')));
					else
					{
						list.forEach((snapshot) =>
						{
							var [time, name] = snapshot.split('_');
							
							div.append(Node.li([
								Node.h3(ae.safeHtml(name||snapshot)),
								Node.div(Node.div({className: 'detail'}, [
									Node.p([
										Node.span({className: 'title'}, Translator.get('snapshot.info.name')),
										Node.span({className: 'text'}, ae.safeHtml(snapshot))
									]),
									Node.p([
										Node.span({className: 'title'}, Translator.get('snapshot.info.date')),
										Node.span({className: 'value'}, new Date(time.replace(/T(\d{2})-(\d{2})-(\d{2})/, 'T$1:$2:$3')))
									]),
									Node.p([
										Node.span({className: 'title'}, Translator.get('snapshot.info.actions')),
										Node.span({className: 'value', dataset: {id: snapshot}}, [
											Node.span({className: 'icon', title: Translator.get('restore'), 
												click: function() { self.restore(this.parentNode.dataset.id); }}, 'settings_backup_restore'),
											Node.span({className: 'icon', title: Translator.get('download'), 
												click: function() { self.download(this.parentNode.dataset.id); }}, 'download'),
											Node.span({className: 'icon', title: Translator.get('remove'), 
												click: function() { self.remove(this.parentNode.dataset.id); }}, 'close')
										])
									])
								]))
							]));
						});
					}
					
					self.dom.classList.remove('wait');
				}, (error) =>
				{
					Notify.error(Translator.get('fetch.error'));
				});
			},
			
			remove: function(name)
			{
				var self = this;
				Modal.confirm(Translator.get('snapshot.remove.confirm', name), [Translator.get('remove'), Translator.get('cancel')]).then((index) =>
				{
					if( index > 0 ) return;
					
					self.dom.classList.add('wait');
					Ajax.delete('/api/admin/snapshot/' + name).then(() =>
					{
						Notify.success(Translator.get('snapshot.remove.success'));
						self.refresh();
					}, (error) =>
					{
						Notify.error(Translator.get('snapshot.remove.error'));
						self.dom.classList.remove('wait');
					});
				}, () => {});
			},
			
			download: function(name)
			{
				var self = this;
				
				this.dom.classList.add('wait');
				Ajax.get('/api/admin/snapshot/download/' + encodeURIComponent(name), {responseType: 'blob'}).then((response) =>
				{
					self.dom.classList.remove('wait');
					Node.a({href: URL.createObjectURL(response.response), download: name+".zip", target: '_blank'}).click();
				}, (error) =>
				{
					Notify.error(Translator.get('snapshot.download.error'))
					self.dom.classList.remove('wait');
				});
			},
			
			upload: function()
			{
				var self = this;
				var f = Node.form(
				[
					Node.input({type: 'file', accept: '.zip', name: 'zip', change: function()
					{
						if( !this.files[0] ) return;
						
						self.dom.classList.add('wait');
						Ajax.post('/api/admin/snapshot/upload', {data: f}).then((response) =>
						{
							Notify.success(Translator.get('snapshot.upload.success'));
							self.refresh();
						}, (error) =>
						{
							Notify.error(Translator.get('snapshot.upload.error'));
							self.dom.classList.remove('wait');
						});
					}})
				]);
				f.zip.click();
			},
			
			restore: function(name)
			{
				var self = this;
				Modal.confirm(Translator.get('snapshot.restore.confirm', name), [Translator.get('restore'), Translator.get('cancel')]).then((index) =>
				{
					if( index > 0 ) return;
					
					self.dom.classList.add('wait');
					Ajax.get('/api/admin/snapshot/restore/' + name).then(() =>
					{
						Notify.success(Translator.get('snapshot.restore.success'));
						self.refresh();
					}, (error) =>
					{
						Notify.error(Translator.get('snapshot.restore.error'));
						self.dom.classList.remove('wait');
					});
				}, () => {});
			},
			
			create: function()
			{
				var self = this;
				Modal.prompt(Translator.get('snapshot.name.prompt')).then((form) =>
				{
					self.dom.classList.add('wait');
					Ajax.get('/api/admin/snapshot/create', {data: {name: form.value.value}}).then((result) =>
					{
						Notify.success(Translator.get('snapshot.create.success'));
						self.refresh();
					}, (error) =>
					{
						Notify.error(Translator.get('snapshot.create.error'));
						self.dom.classList.remove('wait');
					});
				}, () => {});
			},
		});
		
		ok(page);
	}, (e) => { nok(e); });
});

export { x as default };