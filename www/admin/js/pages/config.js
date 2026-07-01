import { Page, Node, Ajax, Translator, Notify, Modal } from 'core';
import { css, safeHtml } from 'core';
css('page.config');

class ConfigPage extends Page
{
	async show()
	{
		this.dom.classList.add('config');
		document.body.querySelectorAll('nav li').forEach(e => { if( e.dataset.link == 'config') e.classList.add('selected'); else e.classList.remove('selected'); });

		this.init();
		return Promise.resolve();
	}

	async hide()
	{
		while(this.dom.firstChild) this.dom.firstChild.remove();
		return Promise.resolve();
	}

	init()
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
			Node.h1(Translator.get('config.title')),
			Node.p(Translator.get('config.snapshot.explain')),
			Node.div({id: 'configList'})
		);

		this.refresh();
	}

	filter(value)
	{
		var words = (value||'').split(/\s+/g).map(w => new RegExp((w||'').replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'), 'i'));

		[].slice.call(this.dom.querySelectorAll('section .detail p')).forEach(p =>
		{
			if( !value || value.length == 0 ) { p.classList.remove('hidden'); return; }

			for (var w = 0; w < words.length; w++)
			{
				if( !words[w].test(p.firstChild.textContent) && !words[w].test(p.lastChild.textContent) )
				{
					p.classList.add('hidden');
					return;
				}
			}
			p.classList.remove('hidden');
		});

		// hide main section if empty
		[].slice.call(this.dom.querySelectorAll('section .detail')).forEach(div =>
		{
			if( !value || value.length == 0 )
			{
				div.parentNode.parentNode.classList.remove('hidden');
			}
			else if( !!div.querySelector('p:not(.hidden)') )
			{
				div.parentNode.parentNode.classList.add('open')
				div.parentNode.parentNode.classList.remove('hidden')
			}
			else
			{
				div.parentNode.parentNode.classList.add('hidden')
			}
		});
	}

	refresh()
	{
		var self = this;
		var div = this.dom.querySelector('#configList');
		while(div.firstChild) div.firstChild.remove();

		Ajax.get('/api/admin/config/list').then((result) =>
		{
			self.configs = result.response;

			const documented = self.configs.filter(c => !!c.definition.summary).sort((a, b) => { return a.entity < b.entity ? -1 : a.entity == b.entity ? a.name.toLowerCase().localeCompare(b.name.toLowerCase()) : 1; });
			const undocumented = self.configs.filter(c => !c.definition.summary).sort((a, b) => { return a.entity < b.entity ? -1 : a.entity == b.entity ? a.name.toLowerCase().localeCompare(b.name.toLowerCase()) : 1; });

			Object.entries(Object.groupBy(documented, (c) => c.entity)).forEach((e) =>
			{
				div.append(
					Node.section({className: 'open'}, [
						Node.h2({click: function() { this.parentNode.classList.toggle('open'); }}, safeHtml(e[0])),
						Node.div({click: function(e)
						{
							if( !e.target.classList.contains('icon') ) return;
							if( e.target.classList.contains('edit') ) self.edit(e.target.parentNode.dataset.entity, e.target.parentNode.dataset.name);
							else if( e.target.classList.contains('clear') ) self.remove(e.target.parentNode.dataset.entity, e.target.parentNode.dataset.name);
							else if( e.target.classList.contains('info') ) self.info(e.target.parentNode.dataset.entity, e.target.parentNode.dataset.name);
						}},
						[
							Node.div({className: 'detail'}, e[1].map((u) =>
								{
									return Node.p({dataset: {entity: u.entity, name: u.name}}, [
										Node.span({className: 'title'}, safeHtml(u.entity + " > " + u.name)),
										Node.span({className: 'icon info'}, 'info'),
										Node.span({className: 'icon edit'}, 'edit'),
										Node.span({className: 'icon clear'}, 'clear'),
										Node.span({className: 'text'}, safeHtml(u.value))
									]);
								})
							)
						])
					])
				);
			});

			div.append(
				Node.section({className: 'open'}, [
					Node.h2({click: function() { this.parentNode.classList.toggle('open'); }}, Translator.get('config.undocumented')),
					Node.div({click: function(e)
					{
						if( !e.target.classList.contains('icon') ) return;
						if( e.target.classList.contains('edit') ) self.edit(e.target.parentNode.dataset.entity, e.target.parentNode.dataset.name);
						else if( e.target.classList.contains('clear') ) self.remove(e.target.parentNode.dataset.entity, e.target.parentNode.dataset.name);
						else if( e.target.classList.contains('info') ) self.info(e.target.parentNode.dataset.entity, e.target.parentNode.dataset.name);
					}},
					[
						Node.p(Translator.get('config.undocumented.explain')),
						Node.div({className: 'detail'}, undocumented.map((u) =>
							{
								return Node.p({dataset: {entity: u.entity, name: u.name}}, [
									Node.span({className: 'title'}, safeHtml(u.entity + " > " + u.name)),
									Node.span({className: 'icon edit'}, 'edit'),
									Node.span({className: 'icon clear'}, 'clear'),
									Node.span({className: 'text'}, safeHtml(u.value))
								]);
							})
						)
					])
				])
			);

			// re-apply filter if needed
			self.filter(self.dom.querySelector('.search input').value);

			self.dom.classList.remove('wait');
		}, (error) =>
		{
			Notify.error(Translator.get('fetch.error'));
		});
	}

	edit(entity, name)
	{
		var self = this;

		Modal.prompt(
			safeHtml(entity + " > " + name),
			safeHtml(this.configs.find((c) => c.entity == entity && c.name == name).value||'')
		).then((form) =>
		{
			Ajax.post('/api/admin/config/' + encodeURIComponent(entity) + '/' + encodeURIComponent(name), {data: {value: form.value.value}}).then(() =>
			{
				Notify.success(Translator.get('config.edit.ok'));
				self.refresh();
			}, (error) =>
			{
				Notify.error(Translator.get('config.edit.error'));
			});
		}, () => {});
	}

	remove(entity, name)
	{
		var self = this;

		Modal.confirm(Translator.get('config.remove.confirm', safeHtml(entity + " > " + name)), [Translator.get('remove'), Translator.get('cancel')]).then((index) =>
		{
			if( index > 0 ) return;
			Ajax.delete('/api/admin/config/' + encodeURIComponent(entity) + '/' + encodeURIComponent(name)).then(() =>
			{
				Notify.success(Translator.get('config.remove.ok'));
				self.refresh();
			}, (error) =>
			{
				Notify.error(Translator.get('config.remove.error'));
			});
		}, () => {});
	}

	info(entity, name)
	{
		var definition = this.configs.find((c) => c.entity == entity && c.name == name).definition;
		if( !definition )
		{
			Notify.warning(Translator.get('config.info.none'));
			return;
		}

		Modal.alert(Node.div({className: 'configInfo'}, [
			Node.h2(safeHtml(entity + " > " + name)),
			Node.div({className: 'group'}, [
				Node.p([
					Node.span({className: 'title'}, Translator.get('info.config.summary')),
					Node.span({className: 'text'}, safeHtml(definition.summary)),
				]),
				Node.p([
					Node.span({className: 'title'}, Translator.get('info.config.description')),
					Node.span({className: 'text'}, safeHtml(definition.description)),
				]),
				Node.p([
					Node.span({className: 'title'}, Translator.get('info.config.format')),
					Node.span({className: 'value'}, safeHtml(definition.format)),
				]),
				Node.p([
					Node.span({className: 'title'}, Translator.get('info.config.optional')),
					Node.span({className: 'value'}, Translator.get(definition.optional ? 'yes': 'no')),
				]),
				Node.p([
					Node.span({className: 'title'}, Translator.get('info.config.minmax')),
					Node.span({className: 'value'}, safeHtml(definition.min + " / " + definition.max)),
				]),
				Node.p([
					Node.span({className: 'title'}, Translator.get('info.config.default')),
					Node.span({className: 'value'}, safeHtml(JSON.stringify(definition.defaultValue))),
				]),
				Node.p([
					Node.span({className: 'title'}, Translator.get('info.config.values')),
					Node.span({className: 'value'}, definition.values.length > 0 ? safeHtml(JSON.stringify(definition.values)) : ''),
				]),
				Node.p([
					Node.span({className: 'title'}, Translator.get('info.config.rule')),
					Node.span({className: 'value'}, Translator.get(definition.rule ? 'yes': 'no'))
				])
			])
		]));
	}
}

const page = new ConfigPage();
export { page as default };
