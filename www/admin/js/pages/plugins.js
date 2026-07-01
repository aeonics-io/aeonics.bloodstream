import { Page, Node, Ajax, Translator, Notify, Modal } from 'core';
import { css, safeHtml } from 'core';
css('page.plugins');

class PluginsPage extends Page
{
	async show()
	{
		this.dom.classList.add('plugins');
		document.body.querySelectorAll('nav li').forEach(e => { if( e.dataset.link == 'plugins') e.classList.add('selected'); else e.classList.remove('selected'); });

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
			Node.h1(Translator.get('plugins.title')),
			Node.p(Translator.get('plugins.explain')),
			Node.div({className: 'action'},
			[
				Node.button({className: 'raised', click: (e) => { e.preventDefault(); this.deploy(); }}, [
					Node.span({className: 'icon'}, 'deployed_code'),
					Node.span(Translator.get('plugins.action.deploy'))]),
				Node.button({className: 'raised', click: (e) => { e.preventDefault(); this.reboot(); }}, [
					Node.span({className: 'icon'}, 'power_settings_new'),
					Node.span(Translator.get('plugins.action.reboot'))])
			]),
			Node.div({id: 'pluginList'})
		);

		this.refresh();
	}

	refresh()
	{
		var self = this;
		var div = this.dom.querySelector('#pluginList');
		while(div.firstChild) div.firstChild.remove();

		Ajax.get('/api/meta/integrity').then((result) =>
		{
			for( const [name, module] of Object.entries(result.response).sort((a, b) => a[0].toLowerCase().localeCompare(b[0].toLowerCase())) )
			{
				if( !module.size ) continue;

				div.append(Node.section([
					Node.h2({click: function() { this.parentNode.classList.toggle('open'); }}, safeHtml(name)),
					Node.div(Node.div({className: 'detail'}, [
						Node.p([
							Node.span({className: 'title'}, Translator.get('info.template.summary')),
							Node.span({className: 'text'}, safeHtml(module.summary||''))
						]),
						Node.p([
							Node.span({className: 'title'}, Translator.get('info.template.description')),
							Node.span({className: 'text'}, safeHtml(module.description||''))
						]),
						Node.p([
							Node.span({className: 'title'}, Translator.get('security.file.name')),
							Node.span({className: 'value'}, safeHtml(module.file||''))
						]),
						Node.p([
							Node.span({className: 'title'}, Translator.get('security.file.modified')),
							Node.span({className: 'value'}, !!module.modified ? new Date(module.modified) : "")
						]),
						Node.p([
							Node.span({className: 'title'}, Translator.get('security.file.size')),
							Node.span({className: 'value'}, safeHtml(module.size))
						]),
						Node.p([
							Node.span({className: 'title'}, Translator.get('security.file.hash')),
							Node.span({className: 'value'}, safeHtml(module.hash))
						]),
						Node.p([
							Node.span({className: 'title'}, ""),
							Node.span({className: 'value action'},
							[
								Node.button({className: 'raised', click: function(e) { e.preventDefault(); self.undeploy(name, module.file); }}, [
									Node.span({className: 'icon'}, 'cancel'),
									Node.span(Translator.get('plugins.action.undeploy'))])
							])
						])
					]))
				]));
			}

			self.dom.classList.remove('wait');
		}, (error) =>
		{
			Notify.error(Translator.get('fetch.error'));
		});
	}

	deploy()
	{
		var self = this;
		var f = Node.input({type: 'file', name: 'file', accept: '.jar', change: function()
		{
			if( !this.files[0] ) return;

			Ajax.post('/api/meta/plugin', {data: Node.form([f])}).then((result) =>
			{
				Notify.success(Translator.get('plugins.deploy.success'));

				Modal.confirm(Translator.get('plugins.reboot_required'), [Translator.get('plugins.action.reboot'), Translator.get('plugins.reboot_later')]).then((index) =>
				{
					if( index > 0 ) { self.refresh(); return; };
					self.reboot_now();
				}, () =>
				{
					self.refresh();
				});
			}, (error) =>
			{
				Notify.error(Translator.get('plugins.deploy.error'));
			});
		}});
		f.click();
	}

	reboot()
	{
		var self = this;
		Modal.confirm(Translator.get('plugins.reboot.confirm'), [Translator.get('plugins.action.reboot'), Translator.get('cancel')]).then((index) =>
		{
			if( index > 0 ) return;
			self.reboot_now();
		}, () => {});
	}

	reboot_now()
	{
		var self = this;
		Ajax.post('/api/meta/system/shutdown');
		var m = Modal.custom(Translator.get('plugins.reboot_pending'), false);
		var i = setInterval(() =>
		{
			Ajax.get('/api/ping').then((result) =>
			{
				clearInterval(i);
				m.ok();
				location.reload();
			}, (error) => {});
		}, 3000);
	}

	undeploy(module, file)
	{
		var self = this;
		Modal.confirm(Translator.get('plugins.remove.confirm', safeHtml(module)), [Translator.get('remove'), Translator.get('cancel')]).then((index) =>
		{
			if( index > 0 ) return;
			Ajax.delete("/api/meta/plugin/" + file).then((result) =>
			{
				Notify.success(Translator.get('plugins.remove.success'));

				Modal.confirm(Translator.get('plugins.reboot_required'), [Translator.get('plugins.action.reboot'), Translator.get('plugins.reboot_later')]).then((index) =>
				{
					if( index > 0 ) { self.refresh(); return; };
					self.reboot_now();
				}, () =>
				{
					self.refresh();
				});
			}, (error) =>
			{
				Notify.error(Translator.get('plugins.remove.error'));
			});
		}, () => {});
	}
}

const page = new PluginsPage();
export { page as default };
