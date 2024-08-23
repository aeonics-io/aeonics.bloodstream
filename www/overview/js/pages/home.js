
let ae = globalThis.ae;
var x = new Promise((ok, nok) =>
{
	ae.require('Page', 'Node', 'Translator', 'Ajax', 'Notify', 'page.home.css', 'ext/d3-force.min.js', 'ext/d3-quadtree.min.js', 'ext/force-graph.min.js').then(([Page, Node, Translator, Ajax, Notify]) =>
	{
		Translator.load('default').then(() =>
		{
			ok(Object.assign(new Page(), 
			{
				show: function()
				{
					this.dom.classList.add('cellgraph');
					
					this.highlightNodes = new Set();
					this.highlightLinks = new Set();
					this.hoverNode = null;
					
					this.load();
					
					return Promise.resolve();
				},
				
				hide: function()
				{
					this.data = null;
					if( this._graph )
						this._graph.pauseAnimation().graphData({ nodes: [], links: [] });
					this._graph = null;
					while(this.dom.firstChild) this.dom.firstChild.remove();
					return Promise.resolve(); 
				},
				
				load: function()
				{
					var self = this;
					
					this.dom.append(
						Node.div({id: 'graph'}),
						Node.div({id: 'infopanel'},
						[
							Node.aside({click: function(e) { this.parentNode.classList.remove('open'); }, title: Translator.get('close')}, 'close'),
							Node.div({className: 'content'})
						]),
						Node.div({id: 'nodeSearch'},
						[
							Node.input({type: 'search', input: function()
							{
								var value = this.value;
								var words = (value||'').split(/\s+/g).map(w => new RegExp((w||'').replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'), 'i'));
								
								self.data.nodes.forEach((n) =>
								{
									if( !value || value.length == 0 ) { n.visible = true; return; }
									
									for( var w = 0; w < words.length; w++ )
									{
										if( !words[w].test(n.name) && !words[w].test(n.id) )
										{
											n.visible = false;
											return;
										}
									}
									n.visible = true;
								});
							}}),
							Node.span({className: 'icon'}, 'search')
						])
					);
					this.getData();
				},
				
				highlightNode: function(node)
				{
					var self = this;
					this.highlightNodes.clear();
					this.highlightLinks.clear();
					if (node)
					{
						node.visible = true;
						this.highlightNodes.add(node);
						node.neighbors.forEach(neighbor => self.highlightNodes.add(neighbor));
						node.links.forEach(link => self.highlightLinks.add(link));
					}
					this.hoverNode = node || null;
				},
				
				nodeClick: function(node)
				{
					if( typeof node === 'string' )
						node = this.data.nodes.find((n) => n.id == node);
					
					this.highlightNode(node);
					if( !node ) return;
					
					if( node.type == 'e' )
						this.showInfo(node);
					else if( node.type == 'r1' )
						this.listRegistry(node.name);
					else if( node.type == 'f1' )
						this.listFactory(node.name);
					else if( node.type == 'p1' )
						this.listPlugin(node.name);
				},
				
				// =================================
				//
				// ENTITY INFO
				//
				// =================================
				
				showInfo: function(node)
				{
					var self = this;
					
					var p = document.getElementById('infopanel');
					p.scrollTop = 0;
					p.classList.add('open');
					p.classList.add('wait');
					
					Ajax.get('/api/meta/entity/' + node.category + '/' + node.id).then((response) =>
					{
						const entity = response.response;
						Ajax.get('/api/meta/template/' + node.category + '/' + node.subtype).then((response) =>
						{
							const template = response.response;
							p.classList.remove('wait');
							var i = p.querySelector('.content');
							while( i.firstChild ) i.lastChild.remove();
							
							i.append(
								Node.h1(ae.safeHtml(entity.__name||'-no name-')),
								self.getEntityInfo(entity),
								self.getTemplateInfo(template)
							);
							
							if( template.hasOwnProperty('inputs') || template.hasOwnProperty('outputs') )
								i.append(self.getChannelInfo(template.inputs, template.outputs));
							
							i.append(
								self.getConfigInfo(entity, template),
								self.getRelationInfo(entity, template)
							);
						}, (error) =>
						{
							p.classList.remove('open');
							Notify.error(Translator.get('fetch.error'));
						});
					}, (error) =>
					{
						p.classList.remove('open');
						Notify.error(Translator.get('fetch.error'));
					});
				},
				
				getEntityInfo: function(entity)
				{
					var self = this;
					return Node.section({className: 'open'}, [
						Node.h2({click: function() { this.parentNode.classList.toggle('open'); }}, Translator.get('info.technical')),
						Node.div(Node.div({className: 'detail'}, [
							Node.p([
								Node.span({className: 'title'}, Translator.get('info.entity.id')),
								Node.span({className: 'value'}, ae.safeHtml(entity.__id))
							]),
							Node.p([
								Node.span({className: 'title'}, Translator.get('info.entity.category')),
								Node.span({className: 'value'}, ae.safeHtml(entity.__category)),
								Node.span({className: 'icon ref', 
									dataset: {id: 'registry:'+entity.__category}, 
									title: Translator.get('all'), 
									click: function() { self.nodeClick(this.dataset.id); }}, 'more')
							]),
							Node.p([
								Node.span({className: 'title'}, Translator.get('info.entity.type')),
								Node.span({className: 'value'}, ae.safeHtml(entity.__type)),
								Node.span({className: 'icon ref', 
									dataset: {subtype: entity.__type}, 
									title: Translator.get('all'), 
									click: function() { self.listSubtype(this.dataset.subtype); }}, 'more')
							]),
							Node.p([
								Node.span({className: 'title'}, Translator.get('info.entity.class')),
								Node.span({className: 'value'}, ae.safeHtml(entity.__class))
							]),
							Node.p([
								Node.span({className: 'title'}, Translator.get('info.entity.internal')),
								Node.span({className: 'value'}, Translator.get(entity.__internal ? 'yes': 'no'))
							])
						]))
					]);
				},
				
				getTemplateInfo: function(template)
				{
					var self = this;
					return Node.section({className: 'open'}, [
						Node.h2({click: function() { this.parentNode.classList.toggle('open'); }}, Translator.get('info.template')),
						Node.div(Node.div({className: 'detail'}, [
							Node.p([
								Node.span({className: 'title'}, Translator.get('info.template.summary')),
								Node.span({className: 'text'}, ae.safeHtml(template.summary))
							]),
							Node.p([
								Node.span({className: 'title'}, Translator.get('info.template.description')),
								Node.span({className: 'text'}, ae.safeHtml(template.description))
							]),
							Node.p([
								Node.span({className: 'title'}, Translator.get('info.template.category')),
								Node.span({className: 'value'}, ae.safeHtml(template.category)),
								Node.span({className: 'icon ref', 
									dataset: {id: 'factory:'+template.category}, 
									title: Translator.get('all'), 
									click: function() { self.nodeClick(this.dataset.id); }}, 'more')
							]),
							Node.p([
								Node.span({className: 'title'}, Translator.get('info.template.type')),
								Node.span({className: 'value'}, ae.safeHtml(template.type))
							]),
							Node.p([
								Node.span({className: 'title'}, Translator.get('info.template.type_plugin')),
								Node.span({className: 'value'}, ae.safeHtml(template.__type_plugin))
							]),
							Node.p([
								Node.span({className: 'title'}, Translator.get('info.template.target')),
								Node.span({className: 'value'}, ae.safeHtml(template.target))
							]),
							Node.p([
								Node.span({className: 'title'}, Translator.get('info.template.target_plugin')),
								Node.span({className: 'value'}, ae.safeHtml(template.__target_plugin))
							]),
							Node.p([
								Node.span({className: 'title'}, Translator.get('info.template.class')),
								Node.span({className: 'value'}, ae.safeHtml(template.__class))
							]),
							Node.p([
								Node.span({className: 'title'}, Translator.get('info.template.template_plugin')),
								Node.span({className: 'value'}, ae.safeHtml(template.__plugin))
							])
						]))
					]);
				},
				
				getChannelInfo: function(inputs, outputs)
				{
					var self = this;
					
					if( !inputs ) inputs = {};
					Object.values(inputs).forEach((i) => { i.direction = 'input'; });
					if( !outputs ) outputs = {};
					Object.values(outputs).forEach((i) => { i.direction = 'output'; });
					
					return Node.section({className: 'open'}, [
						Node.h2({click: function() { this.parentNode.classList.toggle('open'); }}, Translator.get('info.channels')),
						Node.div(Node.div({className: 'detail'}, Object.values(inputs).concat(Object.values(outputs))
							.sort((a, b) => { a.name > b.name ? 1 : -1; })
							.map((c) => Node.div({className: 'sublevel'}, [
								Node.h3(ae.safeHtml(c.name)),
								Node.p([
									Node.span({className: 'title'}, Translator.get('info.template.summary')),
									Node.span({className: 'text'}, ae.safeHtml(c.summary))
								]),
								Node.p([
									Node.span({className: 'title'}, Translator.get('info.template.description')),
									Node.span({className: 'text'}, ae.safeHtml(c.description))
								]),
								Node.p([
									Node.span({className: 'title'}, Translator.get('info.channel.direction')),
									Node.span({className: 'value'}, Translator.get('info.channel.direction.'+c.direction))
								])
							]))
						))
					]);
				},
				
				getConfigInfo: function(entity, template)
				{
					const parameters = Object.values(template.parameters);
					const configs = Object.entries(template.configs);
					
					var self = this;
					var content = null;
					if( parameters.length == 0 && configs.length == 0 )
						content = Node.p(Translator.get('info.config.empty'));
					else
					{
						content = parameters.map((p) => self.getParameterInfo(p, entity, null))
							.concat(configs.map((c) => self.getParameterInfo(c[1], entity, c[0])));
					}
					
					return Node.section({className: 'open'}, [
						Node.h2({click: function() { this.parentNode.classList.toggle('open'); }}, Translator.get('info.config')),
						Node.div(Node.div({className: 'detail'}, content))
					]);
				},
				
				getParameterInfo: function(param, entity, config)
				{
					return Node.div([
						Node.fieldset({dataset: {config: config}}, [
							Node.label({htmlFor: '__' + param.name}, ae.safeHtml(param.name)),
							Node.input({type: 'text', readOnly: true, value: entity[param.name]||'', id: '__' + param.name}),
							/*
								TODO : edit parameter/config value
								Node.span({className: 'icon edit', title: Translator.get('edit')}, 'edit'),
							*/
							Node.span({className: 'icon info', title: Translator.get('info'), click: function() { this.parentNode.nextSibling.classList.toggle('open'); }}, 'info')
						]),
						Node.div({className: 'group'}, [
							Node.p([
								Node.span({className: 'title'}, Translator.get('info.config.summary')),
								Node.span({className: 'text'}, ae.safeHtml(param.summary)),
							]),
							Node.p([
								Node.span({className: 'title'}, Translator.get('info.config.description')),
								Node.span({className: 'text'}, ae.safeHtml(param.description)),
							]),
							Node.p([
								Node.span({className: 'title'}, Translator.get('info.config.config')),
								Node.span({className: 'value'}, !!config ? Translator.get('info.config.global', ae.safeHtml(config)) : Translator.get('info.config.local')),
							]),
							Node.p([
								Node.span({className: 'title'}, Translator.get('info.config.format')),
								Node.span({className: 'value'}, ae.safeHtml(param.format)),
							]),
							Node.p([
								Node.span({className: 'title'}, Translator.get('info.config.optional')),
								Node.span({className: 'value'}, Translator.get(param.optional ? 'yes': 'no')),
							]),
							Node.p([
								Node.span({className: 'title'}, Translator.get('info.config.minmax')),
								Node.span({className: 'value'}, ae.safeHtml(param.min + " / " + param.max)),
							]),
							Node.p([
								Node.span({className: 'title'}, Translator.get('info.config.default')),
								Node.span({className: 'value'}, ae.safeHtml(JSON.stringify(param.defaultValue))),
							]),
							Node.p([
								Node.span({className: 'title'}, Translator.get('info.config.bindable')),
								Node.span({className: 'value'}, Translator.get(param.bindable ? 'yes': 'no')),
							]),
							Node.p([
								Node.span({className: 'title'}, Translator.get('info.config.values')),
								Node.span({className: 'value'}, param.values.length > 0 ? ae.safeHtml(JSON.stringify(param.values)) : ''),
							]),
							Node.p([
								Node.span({className: 'title'}, Translator.get('info.config.rule')),
								Node.span({className: 'value'}, Translator.get(param.rule ? 'yes': 'no'))
							])
						])
					]);
				},
				
				getRelationInfo: function(entity, template)
				{
					var self = this;
					
					var content = this.data.links
						.filter((l) => l.target.id == entity.__id && l.source.type == 'e')
						.map((l) => Node.p([
							Node.span({className: 'title'}, Translator.get('info.link.target')),
							Node.span({className: 'value'}, Translator.get('info.link.target2', ae.safeHtml(l.source.name), ae.safeHtml(l.source.subtype))),
							Node.span({className: 'icon ref', 
								dataset: {id: l.source.id}, 
								title: Translator.get('info'), 
								click: function() { self.nodeClick(this.dataset.id); }}, 'link')
						]));
						
					Object.values(template.relations).sort((a, b) => { return a.name > b.name ? 1 : -1; }).forEach((r) =>
					{
						var node = self.getRelationDetail(r, entity[r.name]);
						if( node ) content.push(node);
					});
					
					if( content.length == 0 )
						content = Node.p(Translator.get('info.link.empty'));
					
					return Node.section({className: 'open'}, [
						Node.h2({click: function() { this.parentNode.classList.toggle('open'); }}, Translator.get('info.relationship')),
						Node.div(Node.div({className: 'detail'}, content))
					]);
				},
				
				getRelationDetail: function(rel, ref)
				{
					var self = this;
					var refs = [];
					
					ref.forEach((r) =>
					{
						var e = this.data.nodes.find((x) => x.id == r.id);
						if( !e ) return;
						
						refs.push(Node.p([
							Node.span({className: 'value'}, Translator.get('info.link.target2', ae.safeHtml(e.name), ae.safeHtml(e.subtype))),
							/*
							TODO : display the relation parameters (values and definition) for each link
							Node.span({className: 'icon ref', 
								dataset: {id: r.id}, 
								title: Translator.get('info'), 
								click: function() { self.nodeClick(this.dataset.id); }}, 'tune'),
							*/
							Node.span({className: 'icon ref', 
								dataset: {id: r.id}, 
								title: Translator.get('info'), 
								click: function() { self.nodeClick(this.dataset.id); }}, 'link')
						]));
					});
					
					/*
						TODO : display the relation subtype
					*/
					
					return Node.p([
						Node.span({className: 'title orange'}, ae.safeHtml(rel.name)),
						Node.div({classList: 'many'}, refs)
					]);
				},
				
				// =================================
				//
				// LISTS
				//
				// =================================
				
				listRegistry: function(category)
				{
					var self = this;
					
					var p = document.getElementById('infopanel');
					p.scrollTop = 0;
					var i = p.querySelector('.content');
					while( i.firstChild ) i.lastChild.remove();
					
					i.append(
						Node.h1(ae.safeHtml(category||'-no name-')),
						Node.div({className: 'search'}, [
							Node.input({type: 'search', input: function()
							{
								var value = this.value;
								var words = (value||'').split(/\s+/g).map(w => new RegExp((w||'').replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'), 'i'));
								
								[].slice.call(this.parentNode.nextSibling.children).forEach(li =>
								{
									if( !value || value.length == 0 ) { li.classList.remove('hidden'); return; }
									
									for (var w = 0; w < words.length; w++)
									{
										if( !words[w].test(li.textContent) )
										{
											li.classList.add('hidden');
											return;
										}
									}
									li.classList.remove('hidden');
								});
							}}),
							Node.span({className: 'icon'}, 'search')
						]),
						Node.ul(this.data.nodes
							.filter((n) => n.type == 'e' && n.category == category)
							.map((n) => Node.li({dataset: {id: n.id}, click: function() { self.nodeClick(this.dataset.id); }}, ae.safeHtml(n.name)))
							.sort((a, b) => { return a.textContent > b.textContent ? 1 : -1; })
						)
					);
					
					p.classList.remove('wait');
					p.classList.add('open');
				},
				
				listSubtype: function(type)
				{
					var self = this;
					
					var p = document.getElementById('infopanel');
					p.scrollTop = 0;
					var i = p.querySelector('.content');
					while( i.firstChild ) i.lastChild.remove();
					
					i.append(
						Node.h1(ae.safeHtml(type||'-no name-')),
						Node.div({className: 'search'}, [
							Node.input({type: 'search', input: function()
							{
								var value = this.value;
								var words = (value||'').split(/\s+/g).map(w => new RegExp((w||'').replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'), 'i'));
								
								[].slice.call(this.parentNode.nextSibling.children).forEach(li =>
								{
									if( !value || value.length == 0 ) { li.classList.remove('hidden'); return; }
									
									for (var w = 0; w < words.length; w++)
									{
										if( !words[w].test(li.textContent) )
										{
											li.classList.add('hidden');
											return;
										}
									}
									li.classList.remove('hidden');
								});
							}}),
							Node.span({className: 'icon'}, 'search')
						]),
						Node.ul(this.data.nodes
							.filter((n) => n.type == 'e' && n.subtype == type)
							.map((n) => Node.li({dataset: {id: n.id}, click: function() { self.nodeClick(this.dataset.id); }}, ae.safeHtml(n.name)))
							.sort((a, b) => { return a.textContent > b.textContent ? 1 : -1; })
						)
					);
					
					p.classList.remove('wait');
					p.classList.add('open');
				},
				
				listFactory: function(category)
				{
					var self = this;
					
					var p = document.getElementById('infopanel');
					p.scrollTop = 0;
					var i = p.querySelector('.content');
					while( i.firstChild ) i.lastChild.remove();
					
					// keep only unique type values
					var types = [...new Set(this.data.nodes
						.filter((n) => n.type == 'e' && n.category == category)
						.map((n) => n.subtype))];
					
					var sections = types.sort().map((t) => Node.section({className: 'open'}, [
						Node.h2({click: function() { this.parentNode.classList.toggle('open'); }}, ae.safeHtml(t)),
						Node.div(Node.div({className: 'detail'}, Node.ul(
							this.data.nodes
								.filter((n) => n.type == 'e' && n.subtype == t)
								.map((n) => Node.li({dataset: {id: n.id}, click: function() { self.nodeClick(this.dataset.id); }}, ae.safeHtml(n.name)))
								.sort((a, b) => { return a.textContent > b.textContent ? 1 : -1; })
						)))
					]));
					
					i.append(
						Node.h1(ae.safeHtml(category||'-no name-')),
						Node.div({className: 'search'}, [
							Node.input({type: 'search', input: function()
							{
								var value = this.value;
								var words = (value||'').split(/\s+/g).map(w => new RegExp((w||'').replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'), 'i'));
								
								this.parentNode.parentNode.querySelectorAll('li').forEach(li =>
								{
									if( !value || value.length == 0 ) { li.classList.remove('hidden'); return; }
									
									for (var w = 0; w < words.length; w++)
									{
										if( !words[w].test(li.textContent) )
										{
											li.classList.add('hidden');
											return;
										}
									}
									li.classList.remove('hidden');
								});
								
								this.parentNode.parentNode.querySelectorAll('section').forEach(s =>
								{
									if( s.querySelector("li:not(.hidden)") )
										s.classList.remove('hidden');
									else
										s.classList.add('hidden');
								});
							}}),
							Node.span({className: 'icon'}, 'search')
						])
					);
					i.append(...sections);
					
					p.classList.remove('wait');
					p.classList.add('open');
				},
				
				listPlugin: function(name)
				{
					var self = this;
					
					var p = document.getElementById('infopanel');
					p.scrollTop = 0;
					var i = p.querySelector('.content');
					while( i.firstChild ) i.lastChild.remove();
					
					var lis = this.data.links
						.filter((l) => l.source.id == 'plugin:' + name)
						.map((l) => Node.li({dataset: {id: l.target.id}, click: function() { self.nodeClick(this.dataset.id); }}, ae.safeHtml(l.target.name)))
						.sort((a, b) => { return a.textContent > b.textContent ? 1 : -1; });
					
					i.append(
						Node.h1(ae.safeHtml(name||'-no name-')),
						Node.div({className: 'search'}, [
							Node.input({type: 'search', input: function()
							{
								var value = this.value;
								var words = (value||'').split(/\s+/g).map(w => new RegExp((w||'').replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'), 'i'));
								
								[].slice.call(this.parentNode.nextSibling.children).forEach(li =>
								{
									if( !value || value.length == 0 ) { li.classList.remove('hidden'); return; }
									
									for (var w = 0; w < words.length; w++)
									{
										if( !words[w].test(li.textContent) )
										{
											li.classList.add('hidden');
											return;
										}
									}
									li.classList.remove('hidden');
								});
							}}),
							Node.span({className: 'icon'}, 'search')
						]),
						Node.ul(lis)
					);
					
					p.classList.remove('wait');
					p.classList.add('open');
				},
				
				// =================================
				//
				// GRAPH
				//
				// =================================
				
				getData: function()
				{
					var self = this;
					Ajax.get('/api/meta/overview').then((response) =>
					{
						self.drawObs(response.response);
					}, (error) =>
					{
						Notify.error(Translator.get('fetch.error'));
					});
				},
				
				fixPosition: function(quadrant, main, nodes)
				{
					var offset = 0;//Math.PI / 4;
					
					var main_distance = 600;
					main.fx = main_distance * Math.cos(quadrant * (Math.PI / 2) - offset);
					main.fy = main_distance * Math.sin(quadrant * (Math.PI / 2) - offset);
					
					var node_distance = 400;
					var node_increment_angle = (Math.PI / 2) / (nodes.length+1);
					var node_start_angle = (quadrant * (Math.PI / 2)) - (Math.PI / 4) - offset;
					
					for( var n = 0; n < nodes.length; n++ )
					{
						nodes[n].fx = node_distance * Math.cos((node_start_angle + ((n+1) * node_increment_angle)));
						nodes[n].fy = node_distance * Math.sin((node_start_angle + ((n+1) * node_increment_angle)));
					}
				},
				
				drawObs: function(data)
				{
					// pauseAnimation and resumeAnimation
					// refresh
					// autoPauseRedraw 
					
					// https://github.com/vasturiano/force-graph
					this.data = { nodes: [], links: [] };
					var graphdata = this.data;
					var self = this;
					
					// ===========================
					// REGISTRY
					// ===========================
					
					var node_main = {id: 'registry', name: 'Registry', visible: true, color: '#FB8136', type: 'r0'};
					graphdata.nodes.push(node_main);
					var node_list = [];
					for( const [key, value] of Object.entries(data.registry) )
					{
						var node = {id: 'registry:'+key, name: key, color: '#FB8136', visible: true, type: 'r1'};
						node_list.push(node);
						graphdata.nodes.push(node);
						graphdata.links.push({source: 'registry', target: 'registry:'+key, color: '#FB813680'});
						
						value.forEach(e =>
						{
							graphdata.nodes.push({id: e.id, name: e.name, color: '#E0C200', visible: true, type: 'e', category: key, subtype: e.type});
							graphdata.links.push({source: 'registry:'+key, target: e.id, color: '#FB813640'});
							e.relations.forEach(rel => graphdata.links.push({source: e.id, target: rel, relate: true, color: '#E0C20040'}));
						});
					};
					this.fixPosition(1, node_main, node_list);
					
					// ===========================
					// FACTORY
					// ===========================

					node_main = {id: 'factory', name: 'Factory', visible: true, color: '#36B0FB', type: 'f0'};
					graphdata.nodes.push(node_main);
					node_list = [];
					for( const [key, value] of Object.entries(data.factory) )
					{
						var node = {id: 'factory:'+key, name: key, color: '#36B0FB', visible: true, type: 'f1'};
						node_list.push(node);
						graphdata.nodes.push(node);
						graphdata.links.push({source: 'factory', target: 'factory:'+key, color: '#36B0FB80'});
						
						value.forEach(e =>
						{
							if( data.registry[key] ) data.registry[key].forEach(r =>
							{
								if( r.type == e.type )
									graphdata.links.push({source: 'factory:'+key, target: r.id, creator: true, color: '#36B0FB40'});
							});
						});
					};
					this.fixPosition(3, node_main, node_list);
					
					// ===========================
					// MANAGERS
					// ===========================
					
					node_main = {id: 'manager', name: 'Managers', visible: true, color: '#D21D50', type: 'm0'};
					graphdata.nodes.push(node_main);
					node_list = [];
					for( const [key, value] of Object.entries(data.managers) )
					{
						var node = {id: 'manager:'+key, name: key, color: '#D21D50', visible: true, type: 'm1'};
						node_list.push(node);
						graphdata.nodes.push(node);
						graphdata.links.push({source: 'manager', target: 'manager:'+key, color: '#D21D5080'});
						if( value ) graphdata.links.push({source: 'manager:'+key, target: value, color: '#D21D5040'});
					};
					this.fixPosition(0, node_main, node_list);
					
					// ===========================
					// PLUGINS
					// ===========================
					
					node_main = {id: 'plugin', name: 'Plugins', visible: true, color: '#29C64B', type: 'p0'};
					graphdata.nodes.push(node_main);
					node_list = [];
					data.plugins.forEach(p =>
					{
						var node = {id: 'plugin:'+p.name, name: p.name, color: '#29C64B', visible: true, type: 'p1'};
						node_list.push(node);
						graphdata.nodes.push(node);
						graphdata.links.push({source: 'plugin', target: 'plugin:'+p.name, color: '#29C64B80'});
						
						for( const [key, value] of Object.entries(data.factory) )
						{
							value.forEach(f =>
							{
								if( f.plugin == p.name )
								{
									if( !data.registry[key] )
										return;
									data.registry[key].forEach(r =>
									{
										if( r.type == f.type )
											graphdata.links.push({source: 'plugin:'+p.name, target: r.id, creator: true, color: '#29C64B40'});
									});
								}
							});
						}
					});
					this.fixPosition(2, node_main, node_list);
					
					// ===========================
					// MAP FOR HIGHLIGHT
					// ===========================
					
					graphdata.links.forEach(link => {
						const a = graphdata.nodes.find(n => n.id == link.source);
						const b = graphdata.nodes.find(n => n.id == link.target);
						!a.neighbors && (a.neighbors = []);
						!b.neighbors && (b.neighbors = []);
						a.neighbors.push(b);
						b.neighbors.push(a);

						!a.links && (a.links = []);
						!b.links && (b.links = []);
						a.links.push(link);
						b.links.push(link);
					});
					
					// ===========================
					// IMAGES
					// ===========================
					
					var imgs = {};
					imgs.r0 = new Image(); imgs.r0.src = 'images/registry.png';
					imgs.f0 = new Image(); imgs.f0.src = 'images/factory.png';
					imgs.p0 = new Image(); imgs.p0.src = 'images/plugin.png';
					imgs.m0 = new Image(); imgs.m0.src = 'images/manager.png';
					
					// ===========================
					// GRAPH
					// ===========================
					
					this._graph = ForceGraph()
						(document.getElementById('graph'))
						.linkDirectionalParticles(link => link.relate ? 2 : 0)
						.onNodeDragEnd(node => 
						{
							node.fx = node.x; 
							node.fy = node.y;
						})
						.onBackgroundClick(e =>
						{
							self.highlightNodes.clear();
							self.highlightLinks.clear();
							self.hoverNode = null;
						})
						.onNodeClick(node => 
						{
							if( node.type == 'r0' || node.type == 'f0' || node.type == 'p0' || node.type == 'm0' )
							{
								node.visible = !node.visible;
								graphdata.nodes.forEach(n => {
									if( n.type[0] == node.type[0] )
										n.visible = node.visible;
								});
							}
							else
							{
								self.nodeClick(node);
							}
						})
						.linkWidth(link => self.highlightLinks.has(link) ? 4 : 1)
						.nodeVisibility(n => !!imgs[n.type] || n.visible)
						.linkVisibility(l => (self.highlightLinks.size == 0 || self.highlightLinks.has(l) || l.source.type.endsWith('0')) ? (l.source.visible && l.target.visible) : false)
						.nodeCanvasObject((node, ctx, scale) =>
						{
							var size = 5;
							
							if( imgs[node.type] )
							{
								size = 40;
								ctx.beginPath();
								ctx.arc(node.x, node.y, size, 0, 2 * Math.PI, false);
								ctx.fillStyle = '#1C1B21';
								ctx.strokeStyle = node.color;
								ctx.lineWidth = node === self.hoverNode ? 4 : 2;
								ctx.fill();
								ctx.stroke();
								size = 50;
								ctx.drawImage(imgs[node.type], node.x - size / 2, node.y - size / 2, size, size);
							}
							else if( node.type != 'e' )
							{
								size = 5;
								
								ctx.beginPath();
								ctx.arc(node.x, node.y, size, 0, 2 * Math.PI, false);
								ctx.fillStyle = node.color;
								ctx.strokeStyle = node.color;
								ctx.lineWidth = node === self.hoverNode ? 3 : 1;
								ctx.fill();
								ctx.stroke();
							}
							else
							{
								ctx.beginPath();
								ctx.arc(node.x, node.y, node === self.hoverNode ? 8 : 5, 0, 2 * Math.PI, false);
								ctx.fillStyle = node.color;
								ctx.fill();
							}
						})
						.nodePointerAreaPaint((node, color, ctx) => {
							var size = 5;
							if( imgs[node.type] ) size = 30;
							else size = 10;
							
							ctx.fillStyle = color;
							ctx.fillRect(node.x - size / 2, node.y - size / 2, size, size);
						})
						
						.d3Force('center', null)
						.d3Force('charge', null)
						.d3Force('link', null)
						.d3Force('collide', d3.forceCollide(8))
						.d3Force('radial', d3.forceRadial(200))
						
						.graphData(graphdata)
						;
				}
			}));
		});
	}, (e) => { nok(e); });
});

export { x as default };