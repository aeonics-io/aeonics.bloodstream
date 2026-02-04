import { Page } from 'core';

class LoginPage extends Page
{
	async show()
	{
		return Promise.resolve(null);
	}
}

const page = new LoginPage();
export { page as default };