
let ae = globalThis.ae;
var x = new Promise((ok, nok) =>
{
	ae.require('Page', 'Node', 'Ajax', 'Translator', 'Notify', 'Modal', 'page.endpoints.css', 'ext/prism.js', 'ext/code-input.min.js', 'ext/code-input.min.css', 'ext/prism.css').then(([Page, Node, Ajax, Translator, Notify, Modal]) =>
	{
		var page = new Page();
		Object.assign(page, 
		{
			show: function()
			{
				this.dom.classList.add('endpoints');
				
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
					Node.h1(Translator.get('endpoints.title')),
					Node.p(Translator.get('endpoints.explain')),
					Node.div({className: 'action'},
					[
						Node.button({className: 'raised', click: () => { this.wizard(); }}, [
							Node.span({className: 'icon'}, 'star'), 
							Node.span(Translator.get('endpoints.wizard'))]),
						Node.button({className: 'raised', click: () => { this.upload(); }}, [
							Node.span({className: 'icon'}, 'file_upload'), 
							Node.span(Translator.get('endpoints.upload'))])
					]),
					Node.div({id: 'endpoint_list'})
				);
				
				this.refresh();
			},
			
			filter: function(value)
			{
				var words = (value||'').split(/\s+/g).map(w => new RegExp((w||'').replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'), 'i'));
				
				[].slice.call(this.dom.querySelectorAll('section li .header')).forEach(p =>
				{
					if( !value || value.length == 0 ) { p.parentNode.classList.remove('hidden'); return; }
					
					for (var w = 0; w < words.length; w++)
					{
						if( !words[w].test(p.firstChild.textContent) && !words[w].test(p.lastChild.textContent) )
						{
							p.parentNode.classList.add('hidden');
							return;
						}
					}
					p.parentNode.classList.remove('hidden');
				});
				
				// hide main section if empty
				[].slice.call(this.dom.querySelectorAll('section')).forEach(div => 
				{
					if( !value || value.length == 0 )
					{
						div.classList.remove('hidden');
					}
					else if( !!div.querySelector('li:not(.hidden)') )
					{
						div.classList.add('open')
						div.classList.remove('hidden')
					}
					else
					{
						div.classList.add('hidden')
					}
				});
			},
			
			refresh: function()
			{
				var self = this;
				var div = this.dom.querySelector('#endpoint_list');
				while(div.firstChild) div.firstChild.remove();
				
				this.dom.classList.add('wait');
				Promise.all([
					Ajax.get('/api/meta/registry/aeonics.http.endpoint/entities'),
					Ajax.get('/api/meta/factory/aeonics.http.endpoint/templates'),
					Ajax.get('/api/jit/aeonics.http.endpoint')
				]).then((results) =>
				{
					self.endpoints = results[0].response;
					self.templates = results[1].response;
					
					self.endpoints.sort(function(a, b)
					{
						if( !a.url ) a.url = "/";
						if( !b.url ) b.url = "/";
						var pa = a.url.split('/').slice(0,-1).join('/');
						var pb = b.url.split('/').slice(0,-1).join('/');
						return pa == pb ? (a.url > b.url ? 1 : -1) : (pa > pb ? 1 : -1);
					});
					
					results[2].response.forEach((dynamic) =>
					{
						if( dynamic.relationships.child.length == 0 ) return;
						var eid = dynamic.relationships.child[0].id;
						var e = self.endpoints.find(x => x.id == eid);
						if( e ) e.dynamic = dynamic.id;
					});
					
					var category = null;
					var ul = null;
					self.endpoints.forEach((r) =>
					{
						var parts = r.url.split('/');
						var last = parts.pop();
						var type = parts.pop() || '';
						var leading = parts.join('/');
						
						if( category != (leading + '/' + type) )
						{
							category = (leading + '/' + type);
							ul = Node.ul();
							div.appendChild(Node.section({className: 'open'}, [
								Node.h2({click: function() { this.parentNode.classList.toggle('open'); }}, ae.safeHtml(leading + '/' + type)), 
								Node.div(ul)
							]));
						}
						
						var template = self.getTemplate(r) || {};
						if( !template.parameters ) template.parameters = {};
						
						ul.appendChild(Node.li({className: 'endpoint_'+r.method, dataset: {id: r.id}}, 
						[
							Node.div({className: 'header', click: function(e)
							{
								this.parentNode.classList.toggle('open');
							}}, [
								Node.span({className:'rest_method ' + r.method}, ae.safeHtml(r.method)),
								Node.span({className: 'rest_path'}, ae.safeHtml(r.url))
							]),
							Node.div({className: 'detail'}, [
								Node.p([
									Node.span({className: 'title'}, Translator.get('endpoints.summary')),
									Node.span({className: template.summary ? 'text' : 'value'}, ae.safeHtml(template.summary||Translator.get('endpoints.no_summary')))
								]),
								Node.p([
									Node.span({className: 'title'}, Translator.get('endpoints.description')),
									Node.span({className: template.description ? 'text' : 'value'}, ae.safeHtml(template.description||Translator.get('endpoints.no_summary')))
								]),
								Node.p([
									Node.span({className: 'title'}, Translator.get('endpoints.parameters')),
									Node.span({className: 'value'}, Object.keys(template.parameters).length > 0 ? Object.keys(template.parameters).map(p => 
										Node.span({className: 'tag', dataset: {type: template.type, name: p}, click: function() { self.parameterInfo(this.dataset.type, this.dataset.name); }}, ae.safeHtml(p)))
										: Translator.get('endpoints.no_parameters')
									)
								]),
								Node.p([
									Node.span({className: 'title'}, Translator.get('endpoints.returns')),
									Node.span({className: template.returns ? 'text' : 'value'}, ae.safeHtml(template.returns||Translator.get('endpoints.no_returns')))
								]),
								Node.p([
									Node.span({className: 'title'}, ""),
									Node.span({className: 'value'}, 
									[
										Node.button({className: 'raised', click: function() { self.testEndpoint(r.id); }}, Translator.get('endpoints.test')),
										r.dynamic ? Node.button({className: 'raised', click: function() { self.updateDynamic(r.id); }}, Translator.get('endpoints.update')) : null,
										r.dynamic ? Node.button({className: 'raised', click: function() { self.removeDynamic(r.id); }}, Translator.get('endpoints.remove')) : null,
									])
								])
							])
						]));
					});
					
					if( !div.firstChild ) // no result
					{
						div.appendChild(Node.p(Translator.get('endpoints.empty')));
					}
					
					// re-apply filter if needed
					self.filter(self.dom.querySelector('.search input').value);
					
					self.dom.classList.remove('wait');
				}, (error) =>
				{
					Notify.error(Translator.get('fetch.error'));
				});
			},
			
			getTemplate: function(entity)
			{
				return this.templates.find((t) => t.type == entity.type);
			},
			
			parameterInfo: function(template, name)
			{
				var t = this.templates.find(x => x.type == template);
				if( !t || !t.parameters[name] )
				{
					Notify.warning(Translator.get('endpoints.fail.template'));
					return;
				}
				var definition = t.parameters[name];
				
				Modal.alert(Node.div({className: 'parameterInfo'}, [
					Node.h2(ae.safeHtml(name)),
					Node.div({className: 'group'}, [
						Node.p([
							Node.span({className: 'title'}, Translator.get('info.config.summary')),
							Node.span({className: 'text'}, ae.safeHtml(definition.summary)),
						]),
						Node.p([
							Node.span({className: 'title'}, Translator.get('info.config.description')),
							Node.span({className: 'text'}, ae.safeHtml(definition.description)),
						]),
						Node.p([
							Node.span({className: 'title'}, Translator.get('info.config.format')),
							Node.span({className: 'value'}, ae.safeHtml(definition.format)),
						]),
						Node.p([
							Node.span({className: 'title'}, Translator.get('info.config.optional')),
							Node.span({className: 'value'}, Translator.get(definition.optional ? 'yes': 'no')),
						]),
						Node.p([
							Node.span({className: 'title'}, Translator.get('info.config.minmax')),
							Node.span({className: 'value'}, ae.safeHtml(definition.min + " / " + definition.max)),
						]),
						Node.p([
							Node.span({className: 'title'}, Translator.get('info.config.default')),
							Node.span({className: 'value'}, ae.safeHtml(JSON.stringify(definition.defaultValue))),
						]),
						Node.p([
							Node.span({className: 'title'}, Translator.get('info.config.values')),
							Node.span({className: 'value'}, definition.values.length > 0 ? ae.safeHtml(JSON.stringify(definition.values)) : ''),
						]),
						Node.p([
							Node.span({className: 'title'}, Translator.get('info.config.rule')),
							Node.span({className: 'value'}, Translator.get(definition.rule ? 'yes': 'no'))
						])
					])
				]));
			},
			
			testEndpoint: function(id)
			{
				var e = this.endpoints.find(x => x.id == id);
				if( !e )
				{
					Notify.warning(Translator.get('endpoints.fail.endpoint'));
					return;
				}
				var t = this.templates.find(x => x.type == e.type);
				if( !t )
				{
					Notify.warning(Translator.get('endpoints.fail.template'));
					return;
				}
				
				var p = Modal.custom(
				[
					Node.form({className: 'endpoint_tester'},
					[
						Node.div(
						[
							Node.span({className: 'rest_method ' + e.method}, ae.safeHtml(e.method)),
							Node.span({className: 'rest_path ' + e.url}, ae.safeHtml(e.url))
						]),
						Object.values(t.parameters).map(param => Node.input({type: 'text', name: param.name, placeholder: 'Parameter: '+param.name})),
						Node.p([
							Node.span({className: 'icon'}, 'lock'),
							Node.span(Translator.get('endpoints.test.auth'))
						]),
						Node.div({className: 'endpoint_auth'},
						[
							Node.input({type: 'radio', name: '__auth__', checked: true, value: 'current', id: 'endpoint_tester_auth_current'}), 
							Node.label({htmlFor: 'endpoint_tester_auth_current'}, Translator.get('endpoints.test.current_user')), 
							Node.br(),
							Node.input({type: 'radio', name: '__auth__', value: 'anonymous', id: 'endpoint_tester_auth_anonymous'}), 
							Node.label({htmlFor: 'endpoint_tester_auth_anonymous'}, Translator.get('endpoints.test.anonymous')), 
							Node.br(),
							Node.input({type: 'radio', name: '__auth__', value: 'user', id: 'endpoint_tester_auth_user'}), 
							Node.input({type: 'text', placeholder: Translator.get('endpoints.test.token'), name: '__user__', input: function() { this.previousSibling.checked = true; }})
						])
					]),
					Node.button({className: 'raised', click: function()
					{
						var form = this.previousSibling;
						var data = {};
						for( var i = 0; i < form.elements.length; i++ )
						{
							let f = form.elements[i];
							if( !f.name.startsWith('__') )
								data[f.name] = f.value;
						}
						
						var options = {method: e.method, data: data};
						
						if( form.__auth__.value == 'anonymous' ) { options.headers = {Authorization: null}; }
						else if( form.__auth__.value == 'user' ) { options.headers = {Authorization: 'Bearer ' + form.__auth__.value}; }
						
						var url = e.url.replace(/{([^}]+)}/g, (match, p1) => {
							let value = encodeURIComponent(data[p1] || '');
							delete data[p1];
							return value;
						});
						
						var now = new Date().getTime();
						Ajax.fetch(url, options).then((response) =>
						{
							var roundtrip = new Date().getTime() - now;
							var ms = null;
							if( response.headers.hasOwnProperty('x-ns-process') )
								ms = Math.round((parseInt(response.headers['x-ns-process'])/100000))/10 + "ms";
							else
								ms = "-";

							var ct = response.headers[Object.keys(response.headers).find(key => key.toLowerCase() == 'content-type')];
							if( response.status == 204 || !ct.toLowerCase().includes('application/json') )
							{
								Modal.alert(Node.div({className: 'parameterInfo'},
								[
									Node.div({className: 'group'}, [
										Node.p([
											Node.span({className: 'title'}, Translator.get('endpoints.result.status')),
											Node.span({className: 'text'}, ae.safeHtml(""+response.status))
										]),
										Node.p([
											Node.span({className: 'title'}, Translator.get('endpoints.result.roundtrip')),
											Node.span({className: 'value'}, roundtrip + "ms")
										]),
										Node.p([
											Node.span({className: 'title'}, Translator.get('endpoints.result.processing')),
											Node.span({className: 'value'}, ms)
										])
									])
								]));
								
								if( response.loaded > 0 )
								{
									if( !(response.response instanceof Blob) )
										response.response = new Blob([response.response], {type: ct});
									var cd = response.headers[Object.keys(response.headers).find(key => key.toLowerCase() == 'content-disposition')];
									if( cd ) cd = cd.match(/filename=['"]?(.*?)['"]?(;|$)/img)[1];
									var a = Node.a({href: URL.createObjectURL(response.response), download: cd||"response", target: '_blank'});
									a.click();
								}
							}
							else
							{
								Modal.alert(Node.div({className: 'parameterInfo'},
								[
									Node.div({className: 'group'}, [
										Node.p([
											Node.span({className: 'title'}, Translator.get('endpoints.result.status')),
											Node.span({className: 'text'}, ae.safeHtml(""+response.status))
										]),
										Node.p([
											Node.span({className: 'title'}, Translator.get('endpoints.result.roundtrip')),
											Node.span({className: 'value'}, roundtrip + "ms")
										]),
										Node.p([
											Node.span({className: 'title'}, Translator.get('endpoints.result.processing')),
											Node.span({className: 'value'}, ms)
										]),
										Node.pre({className: 'response'}, Node.code({id: 'endpoint_response', className: "language-json"}, JSON.stringify(response.response, null, 4)))
									])
								]));
								Prism.highlightElement(document.getElementById('endpoint_response'));
							}
						}, (error) =>
						{
							var roundtrip = new Date().getTime() - now;
							var ms = null;
							if( error.headers.hasOwnProperty('x-ns-process') )
								ms = Math.round((parseInt(error.headers['x-ns-process'])/100000))/10 + "ms";
							else
								ms = "-";
							
							Modal.alert(Node.div({className: 'parameterInfo'},
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
					}}, [Node.span(Translator.get('endpoints.run'))])
				], true);
				p.dom.classList.add('promptable');
			},
			
			// =============================
			//
			// Dynamic endpoints
			//
			// =============================
			
			updateDynamic: function(id)
			{
				var self = this;
				var e = this.endpoints.find(x => x.id == id);
				Ajax.get("/api/meta/entity/aeonics.jit.Dynamic/" + e.dynamic).then((result) =>
				{
					self.reviewSource(result.response.parameters.code, e.dynamic);
				}, (error) =>
				{
					Notify.error(Translator.get('fetch.error'));
				});
			},
			
			removeDynamic: function(id)
			{
				var self = this;
				var e = this.endpoints.find(x => x.id == id);
				Modal.confirm(Translator.get('endpoints.remove.confirm', e.method, e.url), [Translator.get('remove'), Translator.get('cancel')]).then((index) =>
				{
					if( index > 0 ) return;
					Ajax.delete("/api/meta/entity/aeonics.jit.Dynamic/" + e.dynamic).then((result) =>
					{
						Notify.success(Translator.get('endpoints.remove.ok'));
						self.refresh();
					}, (error) =>
					{
						Notify.error(Translator.get('endpoints.remove.error'));
					});
				}, () => {});
			},
			
			wizard: function()
			{
				var self = this;
				
				Modal.prompt(Translator.get('endpoints.wizard.title'), Node.form([
					Node.select({name: 'method'}, [
						Node.option({value: 'GET'}, 'GET'), 
						Node.option({value: 'GET'}, 'POST'), 
						Node.option({value: 'GET'}, 'PUT'), 
						Node.option({value: 'GET'}, 'DELETE')
					]),
					Node.input({name: 'url', placeholder: Translator.get('endpoints.wizard.url')}),
					Node.input({name: 'summary', placeholder: Translator.get('endpoints.wizard.summary')}),
					Node.input({name: 'description', placeholder: Translator.get('endpoints.wizard.description')}),
					Node.input({name: 'returns', placeholder: Translator.get('endpoints.wizard.returns')})
				])).then((form) =>
				{
					var code = "import aeonics.data.*;\nimport aeonics.entity.*;\nimport aeonics.http.*;\nimport aeonics.util.Functions.*;\n\n"
						+ "public class Custom implements Supplier<Entity> {\n"
						+ "\tpublic Entity get() {\n"
						+ "\t\treturn new Endpoint.Rest() { }\n"
						+ "\t\t\t.template()\n"
						+ "\t\t\t.returns(\"" + form.returns.value.replaceAll(/\\/g, '\\\\').replaceAll(/"/g,'\\"') + "\")\n"
						+ "\t\t\t.summary(\"" + form.summary.value.replaceAll(/\\/g, '\\\\').replaceAll(/"/g,'\\"') + "\")\n"
						+ "\t\t\t.description(\"" + form.description.value.replaceAll(/\\/g, '\\\\').replaceAll(/"/g,'\\"') + "\")\n"
						+ "\t\t\t.create()\n"
						+ "\t\t\t.<Endpoint.Rest.Type>cast()\n"
						+ "\t\t\t.process((data, user) -> {\n"
						+ "\t\t\t\t// YOUR CODE HERE\n"
						+ "\t\t\t\treturn Data.map().put(\"success\", true);\n"
						+ "\t\t\t})\n"
						+ "\t\t\t.url(\"/" + form.url.value.replaceAll(/\\/g, '\\\\').replaceAll(/"/g,'\\"').replace(/^\//, '') + "\")\n"
						+ "\t\t\t.method(\"" + form.method.value + "\");\n"
						+ "\t}\n}";
					
					self.reviewSource(code);
				}, () => {});
			},
			
			upload: function()
			{
				var self = this;
				var f = Node.input({type: 'file', accept: '.java', change: function()
				{
					if( !this.files[0] ) return;
					const reader = new FileReader();
					reader.onload = function() { self.reviewSource(this.result); };
					reader.readAsText(this.files[0]);
				}});
				f.click();
			},
			
			reviewSource: function(code, id)
			{
				var self = this;
				var p = Modal.custom(
				[
					Node.create('code-input', {id: 'source', lang: "Java", value: code, 'line-numbers': true}),
					Node.button({click: function() {
						var w = Modal.custom(Node.p({id: 'waiter_text'}, Translator.get('endpoints.wizard.wait')), false);
						
						var data = {code: this.previousSibling.value};
						if( !!id ) data.id = id;
						
						Ajax.post('/api/jit/entity', {data: data}).then((response) =>
						{
							Notify.success(Translator.get('endpoints.wizard.success'));
							w.ok();
							p.ok();
							self.refresh();
						}, (error) => 
						{
							Notify.error(Translator.get('endpoints.wizard.fail'));
							w.ok();
							
							if( error.response.error && error.response.error.length > 0 )
							{
								error = error.response.error[0];
								Modal.alert(Translator.get('endpoints.wizard.fail2', ae.safeHtml(""+error[1]), ae.safeHtml(""+error[3])));
							}
						});
					}}, Node.span(Translator.get('endpoints.wizard.deploy')))
				], true);
			},
		});
		
		ok(page);
	}, (e) => { nok(e); });
});

export { x as default };