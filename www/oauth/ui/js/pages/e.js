import { Page, Node, Translator } from 'core';
import { css, urlValue } from 'core';
css('e');

class ErrorPage extends Page
{
	async show()
	{
		const error = urlValue('error');

		this.dom.classList.add('error');
		this.dom.appendChild(
			Node.div({id: 'error_panel'}, [
				Node.p({className: 't1'}, Translator.get('error.title')),
				Node.p({className: 't2'}, Translator.get('error.class.' + error))
			])
		);
		return Promise.resolve();
	}
}

const page = new ErrorPage();
export { page as default };