
let ae = globalThis.ae;
var x = new Promise((ok, nok) =>
{
	ae.require('Node', 'Translator', 'Modal', 'Ajax', 'Notify').then(([Node, Translator, Modal, Ajax, Notify]) =>
	{
		class Entity
		{
			static edit(entity)
			{
				if( !entity || !entity.id || !entity.category || !entity.type )
				{
					Notify.error(Translator.get('entity.edit.invalid'));
					return Promise.reject();
				}
				else
					return Entity.__prompt(entity, entity.category, entity.type);
			}
			
			static create(category, type)
			{
				if( !category )
				{
					Notify.error(Translator.get('entity.create.invalid'));
					return Promise.reject();
				}
				if( !type )
					return Entity.__choose(category);
				else
					return Entity.__prompt(null, category, type);
			}
			
			static explore()
			{
				var div = Node.div({id: 'entity_editor', className: 'wait'});
				var ok, nok;
				var p  = new Promise((_ok, _nok) => { ok = _ok; nok = _nok; });
				p.ok = ok;
				p.nok = nok;
				var m = Modal.custom(div, true);
				m.then(() => {}, () => { p.nok(); });
				m.dom.classList.add('promptable');
				
				Ajax.get('/api/meta/factory/categories').then((result) =>
				{
					result.response.sort((a, b) => { return a > b ? 1 : -1; });
					
					div.append(
						Node.p(Translator.get('entity.choose.category')),
						Node.select(result.response.map(c => Node.option({value: c}, ae.safeHtml(c)))),
						Node.button({click: function(e)
						{
							e.preventDefault();
							m.ok();
						}}, Translator.get('cancel')),
						Node.button({click: function(e)
						{
							e.preventDefault();
							m.ok();
							Entity.__choose(this.previousSibling.previousSibling.value).then(() => p.ok(), () => p.nok());
						}}, Translator.get('ok'))
					);
					div.classList.remove('wait');
				}, (error) =>
				{
					Notify.error(Translator.get('entity.template.error'));
					m.ok();
					p.nok();
				});
				
				return p;
			}
			
			static __choose(category)
			{
				var div = Node.div({id: 'entity_editor', className: 'wait'});
				var ok, nok;
				var p  = new Promise((_ok, _nok) => { ok = _ok; nok = _nok; });
				p.ok = ok;
				p.nok = nok;
				var m = Modal.custom(div, true);
				m.then(() => {}, () => { p.nok(); });
				m.dom.classList.add('promptable');
				
				Ajax.get('/api/meta/factory/' + encodeURIComponent(category) + '/templates').then((result) =>
				{
					if( result.response.length == 1 )
					{
						m.ok();
						Entity.__prompt(null, category, result.response[0].type).then(() => p.ok(), () => p.nok());
						return;
					}
					
					result.response.sort((a, b) => { return a.name > b.name ? 1 : -1; });
					
					div.append(
						Node.ul(
							result.response.map(t => Node.li({dataset: {type: t.type}, click: function() 
							{
								m.ok();
								Entity.__prompt(null, category, this.dataset.type).then(() => p.ok(), () => p.nok());
							}}, 
							[
								Node.h2(ae.safeHtml(t.summary)),
								Node.p(ae.safeHtml(t.description))
							]))
						)
					);
					div.classList.remove('wait');
				}, (error) =>
				{
					Notify.error(Translator.get('entity.template.error'));
					m.ok();
					p.nok();
				});
				
				return p;
			}
			
			static __prompt(entity, category, type)
			{
				var div = Node.div({id: 'entity_editor', className: 'wait'});
				var ok, nok;
				var p  = new Promise((_ok, _nok) => { ok = _ok; nok = _nok; });
				p.ok = ok;
				p.nok = nok;
				var m = Modal.custom(div, true);
				m.then(() => {}, () => { p.nok(); });
				m.dom.classList.add('promptable');
				
				Ajax.get('/api/meta/template/' + encodeURIComponent(category) + '/' + encodeURIComponent(type)).then((result) =>
				{
					var t = result.response;
					
					div.append(
						Node.h2(ae.safeHtml(t.summary)),
						Node.p(ae.safeHtml(t.description)),
						Node.form(
						[
							Node.fieldset({className: 'required'}, [
								Node.label({htmlFor: 'entity__name'}, Translator.get('entity.name')),
								Node.input({type: 'text', name: '__name', id: 'entity__name', value: entity?entity.name:''}),
								Node.p(Translator.get('entity.name.description'))
							]),
							Object.entries(t.parameters).sort((a, b) => { return a[1].summary > b[1].summary ? 1 : -1; }).map(([key, detail]) =>
							{
								return Node.fieldset({className: detail.optional ? '' : 'required'}, [
									Node.label({htmlFor: 'entity__' + key}, ae.safeHtml(detail.summary)),
									Entity.__getField(key, detail, entity?entity.parameters[key]:null),
									Node.p(ae.safeHtml(detail.description))
								])
							}),
							Node.button({click: function(e)
							{
								e.preventDefault();
								m.ok();
							}}, Translator.get('cancel')),
							Node.button({click: function(e)
							{
								e.preventDefault();
								div.classList.add('wait');
								
								var form = this.parentNode;
								var data = {name: form.__name.value, parameters: {}, relationships: {}};
								for( var e of form.elements )
								{
									if( e.name && e.name != '__name' )
									{
										if( e.type != 'checkbox' || e.checked )
											data.parameters[e.name] = e.value;
									}
								}
								
								if( entity )
								{
									Ajax.put('/api/meta/entity/' + encodeURIComponent(category) + '/' + encodeURIComponent(entity.id), 
										{data: {data: JSON.stringify(data)}}).then((result) => 
									{
										Notify.success(Translator.get('entity.edit.success'));
										m.ok();
										p.ok();
									}, (error) =>
									{
										Notify.error(Translator.get('entity.edit.error'));
										div.classList.remove('wait');
									});
								}
								else
								{
									Ajax.post('/api/meta/entity/'+ encodeURIComponent(category) + '/' + encodeURIComponent(type), 
										{data: {data: JSON.stringify(data)}}).then((result) => 
									{
										Notify.success(Translator.get('entity.create.success'));
										m.ok();
										p.ok();
									}, (error) =>
									{
										Notify.error(Translator.get('entity.create.error'));
										div.classList.remove('wait');
									});
								}
							}}, Translator.get('save'))
						])
					);
					div.classList.remove('wait');
				}, (error) =>
				{
					Notify.error(Translator.get('entity.template.error'));
					m.ok();
					p.nok();
				});
				
				return p;
			}
			
			static __getField(key, detail, value)
			{
				switch(detail.format)
				{
					default:
					case "opaque":
					case "text":
						return Node.input({type: 'text', name: key, id: 'entity__' + key, value: value||detail.defaultValue||''});
					case "json":
					case "code":
					case "longtext":
						return Node.textarea({name: key, id: 'entity__' + key}, ''+(value||detail.defaultValue));
					case "number":
						return Node.input({type: 'number', name: key, id: 'entity__' + key, value: value||detail.defaultValue||'0'});
					case "password":
						return Node.input({type: 'password', name: key, id: 'entity__' + key, value: value||detail.defaultValue||''});
					case "boolean":
						return Node.input({type: 'checkbox', name: key, id: 'entity__' + key, checked: value||detail.defaultValue||false});
					case "date":
						return Node.input({type: 'date', name: key, id: 'entity__' + key, value: value||detail.defaultValue||''});
					case "time":
						return Node.input({type: 'time', name: key, id: 'entity__' + key, value: value||detail.defaultValue||''});
					case "datetime":
					{
						var date = new Date();
						if( typeof value == 'number' )
							date = new Date(value);
						else if( typeof value == 'string' )
							date = new Date(value.replace(/\[.*\]$/, ''));
						else if( typeof detail.defaultValue == 'number' )
							date = new Date(detail.defaultValue);
						else if( typeof detail.defaultValue == 'string' )
							date = new Date(detail.defaultValue.replace(/\[.*\]$/, ''));
						date = new Date(date - date.getTimezoneOffset() * 60000);
						
						return Node.input({type: 'datetime-local', name: key, id: 'entity__' + key, value: date.toISOString().slice(0, -1)});
					}
					case "select":
						return Node.select({name: key, id: 'entity__' + key, value: value||detail.defaultValue||''}, 
							detail.values.map(v => Node.option({value: v}, ae.safeHtml(v))));
				}
			}
		}
		
		ok(Entity);
	}, (e) => { nok(e); });
});

export { x as default };