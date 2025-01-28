
let ae = globalThis.ae;
var x = new Promise((ok, nok) =>
{
	ae.require('Page', 'Node', 'Ajax', 'Translator', 'Notify', 'Modal', 'Entity', 'page.access.css').then(([Page, Node, Ajax, Translator, Notify, Modal, Entity]) =>
	{
		var page = new Page();
		Object.assign(page, 
		{
			show: function()
			{
				this.dom.classList.add('access');
				document.body.querySelectorAll('nav li').forEach(e => { if( e.dataset.link == 'access') e.classList.add('selected'); else e.classList.remove('selected'); });
				
				this.init();
				return Promise.resolve();
			},
			
			hide: function()
			{
				while(this.dom.firstChild) this.dom.firstChild.remove();
				this.users = null;
				this.groups = null;
				this.roles = null;
				
				return Promise.resolve(); 
			},
			
			init: function()
			{
				var self = this;
				
				while(this.dom.firstChild) this.dom.firstChild.remove();
				
				this.dom.append(
					Node.h1(Translator.get('access.title')),
					Node.p(Translator.get('access.explain')),
					Node.div({id: 'tab_security_targets', className: 'tab', dataset: {tab: 1}}, [
						Node.div({click: function(e) { self.switchTab(e.target); }}, [
							Node.span(Translator.get('access.tab.users')),
							Node.span(Translator.get('access.tab.groups')),
							Node.span(Translator.get('access.tab.roles')),
							Node.span(Translator.get('access.tab.providers'))
						]),
						Node.div([
							Node.div({className: 'tabcontent', id: 'access_tab_users'}),
							Node.div({className: 'tabcontent', id: 'access_tab_groups'}),
							Node.div({className: 'tabcontent', id: 'access_tab_roles'}),
							Node.div({className: 'tabcontent', id: 'access_tab_providers'})
						])
					]),
					Node.h1(Translator.get('access.title2')),
					Node.p(Translator.get('access.explain2')),
					Node.div({id: 'policyList'})
				);
				
				this.refreshUsers();
				this.refreshRules();
			},
			
			switchTab: function(node)
			{
				if( node.nodeName !== 'SPAN' ) return;
				
				var index = Array.prototype.indexOf.call(node.parentNode.childNodes, node) + 1;
				var t = node.parentNode.parentNode;
				t.dataset.tab = index;
				t.classList.toggle('changed');
			},
			
			filter: function(value, dom)
			{
				var words = (value||'').split(/\s+/g).map(w => new RegExp((w||'').replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'), 'i'));
				
				[].slice.call(dom.querySelectorAll('li')).forEach(p =>
				{
					if( !value || value.length == 0 ) { p.classList.remove('hidden'); return; }
					
					for (var w = 0; w < words.length; w++)
					{
						if( !words[w].test(p.textContent) )
						{
							p.classList.add('hidden');
							return;
						}
					}
					p.classList.remove('hidden');
				});
			},
			
			refreshUsers: function()
			{
				var self = this;
				var div_users = this.dom.querySelector('#access_tab_users');
				while(div_users.firstChild) div_users.firstChild.remove();
				
				var div_groups = this.dom.querySelector('#access_tab_groups');
				while(div_groups.firstChild) div_groups.firstChild.remove();
				
				var div_roles = this.dom.querySelector('#access_tab_roles');
				while(div_roles.firstChild) div_roles.firstChild.remove();
				
				var div_providers = this.dom.querySelector('#access_tab_providers');
				while(div_providers.firstChild) div_providers.firstChild.remove();
				
				this.dom.querySelector('#tab_security_targets').classList.add('wait');
				
				Promise.all([
					Ajax.get('/api/meta/registry/aeonics.entity.security.user/entities'),
					Ajax.get('/api/meta/registry/aeonics.entity.security.group/entities'),
					Ajax.get('/api/meta/registry/aeonics.entity.security.role/entities'),
					Ajax.get('/api/meta/registry/aeonics.entity.security.provider/entities')
				]).then((results) =>
				{
					self.users = results[0].response;
					self.users.sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));
					
					self.groups = results[1].response;
					self.groups.sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));
					
					self.roles = results[2].response;
					self.roles.sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));
					
					self.providers = results[3].response;
					self.providers.sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));
					
					div_users.append(
						Node.div({className: 'search'}, [
							Node.input({type: 'search', input: function()
							{
								self.filter(this.value, div_users);
							}}),
							Node.span({className: 'icon'}, 'search')
						]),
						Node.div({className: 'action'}, Node.button({className: 'raised', click: function(e)
						{
							e.preventDefault();
							Entity.create('aeonics.entity.security.user').then(() => self.refreshUsers(), () => {});
						}}, 
						[
							Node.span({className: 'icon'}, 'create'),
							Translator.get('create')
						])),
						Node.ul({click: function(e)
						{
							if( !e.target.dataset.id ) return;
							var item = self.users.find(x => x.id == e.target.dataset.id);
							if( !item ) return;
							Entity.edit(item).then(() => self.refreshUsers(), () => {});
						}}, self.users.map(x =>
						{
							return Node.li({dataset: {id: x.id}}, ae.safeHtml(x.name));
						}))
					);
					
					div_groups.append(
						Node.div({className: 'search'}, [
							Node.input({type: 'search', input: function()
							{
								self.filter(this.value, div_groups);
							}}),
							Node.span({className: 'icon'}, 'search')
						]),
						Node.div({className: 'action'}, Node.button({className: 'raised', click: function(e)
						{
							e.preventDefault();
							Entity.create('aeonics.entity.security.group').then(() => self.refreshUsers(), () => {});
						}}, 
						[
							Node.span({className: 'icon'}, 'create'),
							Translator.get('create')
						])),
						Node.ul({click: function(e)
						{
							if( !e.target.dataset.id ) return;
							var item = self.groups.find(x => x.id == e.target.dataset.id);
							if( !item ) return;
							Entity.edit(item).then(() => self.refreshUsers(), () => {});
						}}, self.groups.map(x =>
						{
							return Node.li({dataset: {id: x.id}}, ae.safeHtml(x.name));
						}))
					);
					
					div_roles.append(
						Node.div({className: 'search'}, [
							Node.input({type: 'search', input: function()
							{
								self.filter(this.value, div_roles);
							}}),
							Node.span({className: 'icon'}, 'search')
						]),
						Node.div({className: 'action'}, Node.button({className: 'raised', click: function(e)
						{
							e.preventDefault();
							Entity.create('aeonics.entity.security.role').then(() => self.refreshUsers(), () => {});
						}}, 
						[
							Node.span({className: 'icon'}, 'create'),
							Translator.get('create')
						])),
						Node.ul({click: function(e)
						{
							if( !e.target.dataset.id ) return;
							var item = self.roles.find(x => x.id == e.target.dataset.id);
							if( !item ) return;
							Entity.edit(item).then(() => self.refreshUsers(), () => {});
						}}, self.roles.map(x =>
						{
							return Node.li({dataset: {id: x.id}}, ae.safeHtml(x.name));
						}))
					);
					
					div_providers.append(
						Node.div({className: 'search'}, [
							Node.input({type: 'search', input: function()
							{
								self.filter(this.value, div_providers);
							}}),
							Node.span({className: 'icon'}, 'search')
						]),
						Node.div({className: 'action'}, Node.button({className: 'raised', click: function(e)
						{
							e.preventDefault();
							Entity.create('aeonics.entity.security.provider').then(() => self.refreshUsers(), () => {});
						}}, 
						[
							Node.span({className: 'icon'}, 'create'),
							Translator.get('create')
						])),
						Node.ul({click: function(e)
						{
							if( !e.target.dataset.id ) return;
							var item = self.providers.find(x => x.id == e.target.dataset.id);
							if( !item ) return;
							Entity.edit(item).then(() => self.refreshUsers(), () => {});
						}}, self.providers.map(x =>
						{
							return Node.li({dataset: {id: x.id}}, ae.safeHtml(x.name));
						}))
					);
					
					self.dom.querySelector('#tab_security_targets').classList.remove('wait');
				}, (error) =>
				{
					Notify.error(Translator.get('fetch.error'));
				});
			},
			
			refreshRules: function()
			{
				var self = this;
				var div = this.dom.querySelector('#policyList');
				while(div.firstChild) div.firstChild.remove();
				
				Promise.all([
					Ajax.get('/api/meta/registry/aeonics.entity.security.policy/entities'),
					Ajax.get('/api/meta/registry/aeonics.entity.security.rule/entities')
				]).then((results) =>
				{
					self.policies = results[0].response;
					self.policies.sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));
					
					self.rules = results[1].response;
					self.rules.sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));
					
					self.policies.forEach(p =>
					{
						div.append(
							Node.section({className: ''}, [
								Node.h2({click: function() { this.parentNode.classList.toggle('open'); }}, [
									Node.span({className: p.type == 'aeonics.entity.security.policy$allow' ? 'allow' : 'deny'}, p.type == 'aeonics.entity.security.policy$allow' ? 'verified_user' : 'gpp_bad'),
									ae.safeHtml(p.name)
								]),
								Node.div(
								[
									Node.div({className: 'detail'}, 
									[
										Node.p(
										[
											Node.span({className: 'title'}, Translator.get('access.policy.scope')),
											Node.span({className: 'text'}, ae.safeHtml(p.parameters.scope))
										])
									])
								])
							])
						);
					});
				}, (error) =>
				{
					Notify.error(Translator.get('fetch.error'));
				});
			}
		});
		
		ok(page);
	}, (e) => { nok(e); });
});

export { x as default };