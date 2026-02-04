import { App, Page, Node, Translator } from 'core';
import { locale, css, config, safeHtml } from 'core';
css('template');
await locale('default');

class TemplatePage extends Page
{
	async show()
	{
		const container = Node.main({id: "app_container"});
		
		document.body.append(
			container
		);
		
		App.instance.container = container;
		return Promise.resolve(null);
	}
}

const page = new TemplatePage();
export { page as default };