import { Page, Node, Ajax, Translator, Notify, Modal } from 'core';
import { css, safeHtml } from 'core';
css('page.me');

class AccountPage extends Page
{
	async show()
	{
		this.dom.classList.add('me');
		document.body.querySelectorAll('nav li').forEach(e => { e.classList.remove('selected'); });

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
		while(this.dom.firstChild) this.dom.firstChild.remove();

		this.dom.classList.add('wait');

		Ajax.get("/api/security/me").then((result) =>
		{
			var user = result.response;

			self.dom.append(
				Node.h1(safeHtml(user.name)),
				Node.div({className: 'action'},
				[
					Node.button({className: 'raised', click: () => { self.logout(); }}, [
						Node.span({className: 'icon'}, 'logout'),
						Node.span(Translator.get('me.logout'))])
				]),
				Node.section({className: 'open'},
				[
					Node.h2(Translator.get('me.info')),
					Node.div(Node.div({className: 'detail'}, [
						Node.p([
							Node.span({className: 'title'}, Translator.get('me.info.login')),
							Node.span({className: 'value'}, safeHtml(user.login))
						]),
						Node.p([
							Node.span({className: 'title'}, Translator.get('me.info.name')),
							Node.span({className: 'text'}, safeHtml(user.name))
						]),
						Node.p([
							Node.span({className: 'title'}, Translator.get('me.info.id')),
							Node.span({className: 'text'}, Node.a({href: '#home?entity=' + user.id}, safeHtml(user.id)))
						]),
						Node.p([
							Node.span({className: 'title'}, Translator.get('me.info.valid')),
							Node.span({className: 'text'}, Translator.get(!!user.active && !user.anonymous ? 'yes' : 'no'))
						]),
						Node.p([
							Node.span({className: 'title'}, Translator.get('me.info.mfa')),
							Node.span({className: 'text'}, Translator.get(!!user.mfa ? 'yes' : 'no'))
						]),
						Node.p([
							Node.span({className: 'title'}, Translator.get('me.info.groups')),
							Node.span({className: 'value'}, user.groups.map((g) =>
								Node.a({className: 'tag', href: '#home?entity=' + g.id}, safeHtml(g.name))))
						]),
						Node.p([
							Node.span({className: 'title'}, Translator.get('me.info.roles')),
							Node.span({className: 'value'}, user.roles.map((r) =>
								Node.a({className: 'tag', href: '#home?entity=' + r.id}, safeHtml(r.name))))
						])
					]))
				])
			);
			self.dom.classList.remove('wait');

		}, (error) =>
		{
			Notify.error(Translator.get('fetch.error'));
		});
	}

	logout()
	{
		Ajax.post("/api/security/logout").then((result) =>
		{
			localStorage.removeItem('utoken');
			sessionStorage.removeItem('utoken');
			location.reload(true);
		}, (error) =>
		{
			Notify.error(Translator.get('fetch.error'));
		});
	}
}

const page = new AccountPage();
export { page as default };
