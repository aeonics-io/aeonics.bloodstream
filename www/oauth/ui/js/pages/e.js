import { Page, Node, Translator } from 'core';
import { css, safeHtml } from 'core';
css('theme');
css('e');

class ErrorPage extends Page
{
	async show()
	{
		const error = new URLSearchParams(window.location.search).get('error');
		const description = new URLSearchParams(window.location.search).get('error_description');

		this.dom.classList.add('error');
		this.dom.appendChild(
			Node.div({id: 'error_panel'}, [
				Node.p({className: 't1'}, Translator.get('error.title')),
				Node.p({className: 't2'}, Translator.get('error.class.' + error)),
				Node.p({className: 't3'}, safeHtml(description))
			])
		);
		return Promise.resolve();
	}
}

const page = new ErrorPage();
export { page as default };
