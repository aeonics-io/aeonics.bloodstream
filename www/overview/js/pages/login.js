
let ae = globalThis.ae;
var x = new Promise((ok, nok) =>
{
	ae.require('Page', 'Node', 'Notify', 'Modal', 'Ajax', 'Translator', 'Cookie', 'page.login.css').then(([Page, Node, Notify, Modal, Ajax, Translator, Cookie]) =>
	{
		Translator.load('default').then(() =>
		{
			/* ======================
			 * Rules for login:
			 *
			 * 0) check local storage
			 *     0.1) if access token present, go to 3
			 *     0.2) else go to 1
			 *
			 * 1) check if there is a token cookie
			 *     1.1) if no, display the login button and then go to 2
			 *     1.2) if yes it means we are coming back from authentication
			 *         1.2.1) remove the cookie and set local storage
			 *         1.2.2) go to 3
			 *
			 * 2) get local provider and redirect user to login url. Upon completion it will end up back here, go to 1
			 *
			 * 3) redirect the user to the home screen
			 *
			 * ======================
			 */
			
			ok(Object.assign(new Page(), 
			{
				show: function()
				{
					var _ok, _nok;
					this.grantor = new Promise((ok, nok) => 
					{
						_ok = ok;
						_nok = nok;
					});
					this.grantor.ok = _ok;
					this.grantor.nok = _nok;
					
					this.dom.classList.add('login');
					this.dom.appendChild(Node.div({className: 'wait', id: 'login_panel'}));
					document.body.appendChild(this.dom);
					
					this.rule_0();
					return this.grantor;
				},
				
				checkAccess: function(token)
				{
					// todo : check if the token is valid for this app
					// if no, then display a notification and return false
					// if yes, just return true
					return true;
				},
				
				rule_0: function()
				{
					var token = localStorage.getItem('overview_token');
					if( token && this.checkAccess(token) )
						this.rule_3(token);
					else
						this.rule_1();
				},
				
				rule_1: function()
				{
					var cookie = Cookie.get('token');
					Cookie.unset('token', '/overview');
					if( cookie && this.checkAccess(cookie) )
					{
						localStorage.setItem('overview_token', cookie);
						this.rule_3(cookie);
					}
					else this.rule_1_display();
				},
				
				rule_1_display: function()
				{
					var self = this;
					var div = document.getElementById('login_panel');
					while(div.firstChild) div.firstChild.remove();
					
					div.append(
						Node.p(Translator.get("login.required")),
						Node.button({className: 'raised', click: function(e) { e.stopImmediatePropagation(); e.preventDefault(); self.rule_2(); }}, Translator.get('login.login'))
					);
					div.classList.remove('wait');
				},
				
				rule_2: function()
				{
					var self = this;
					var div = document.getElementById('login_panel');
					div.classList.add('wait');
					while(div.firstChild) div.firstChild.remove();
					
					Ajax.get("/oidc/local").then((response) =>
					{
						location.href = response.response.login_redirect;
					}, (error) =>
					{
						div.append(Node.p({className: 'error'}, Translator.get('login.error.fetch')));
						div.classList.remove('wait');
					});
				},
				
				rule_3: function(token)
				{
					Ajax.authorization = 'Bearer ' + token;
					this.dom.classList.remove('wait');
					this.dom.remove();
					this.grantor.ok();
				}
			}));
		});
	}, (e) => { nok(e); });
});

export { x as default };