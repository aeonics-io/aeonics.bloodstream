import { Page, Node, Ajax, Translator } from 'core';
import { css, urlValue, safeHtml } from 'core';
css('l');

class LoginPage extends Page
{
	/* ======================
	 * Rules for login:
	 *
	 * 0) check if the code is correct
	 *     0.1) if no, redirect to error page
	 *     0.2) if yes, go to 1
	 *
	 * 1) get all local storage tokens
	 *     1.1) if none, go to 2
	 *     1.2) for each fetch the user info
	 *         1.2.1) if a token is no longer valid, remove it
	 *     1.3) display the "choose account" screen
	 *         1.3.1) if the user chooses an account, go to 4
	 *         1.3.2) if the user chooses to setup another account, go to 2
	 *
	 * 2) get all remote providers and local provider
	 *     2.1) discard the local provider from the list
	 *     2.2) if there is only 1 provider, go to 3
	 *     2.3) display the choose provider screen
	 *         2.3.1) if the user chooses a provider, go to 3
	 *
	 * 3) activate provider
	 *     3.1) if the provider uri is null, display the username/password prompt and submit to /oauth/login
	 *     3.2) else redirect user to login url. Upon completion it will end up back here, go to 0
	 *
	 * 4) redirect the consent screen
	 *
	 * ======================
	 */ 
	async show()
	{
		this.code = urlValue('code');
		
		this.dom.classList.add('login');
		this.dom.appendChild(Node.div({className: 'wait', id: 'login_panel'}));
		var self = this; setTimeout(function() { self.rule_0(); }, 1);
		return Promise.resolve();
	}
	
	updateCodeValidity()
	{
		var div = this.dom;
		
		var left = Math.floor((this.code_ttl - (Date.now() - this.code_epoch))/1000);
		var min = Math.floor(left / 60);
		var sec = left % 60;
		
		if( left < 0 )
		{
			var searchParams = new URLSearchParams();
			searchParams.set("error", 'expired');
			searchParams.set("error_description", Translator.get('code.validity.expired'));
			location.href = 'error?' + searchParams.toString() + '#e';
		}
		
		div.dataset.ttl = Translator.get('code.validity', (min > 0 ? min + 'min ' : '') + (sec > 0 ? sec + 's' : ''));
		div.classList.toggle('__force_update');
	}
	
	rule_0()
	{
		var self = this;
		var div = document.getElementById('login_panel');
		while(div.firstChild) div.firstChild.remove();
		
		Ajax.get("/oauth/codeinfo", {data: {code: this.code}}).then((response) =>
		{
			self.code_epoch = response.response.epoch;
			self.code_ttl = response.response.ttl;
			self.updateCodeValidity();
			setInterval(() => { self.updateCodeValidity(); }, 1000);
			
			self.providerName = response.response.name;
			self.rule_1();
		}, (error) =>
		{
			var searchParams = new URLSearchParams();
			searchParams.set("error", error.response.error||'server_error');
			searchParams.set("error_description", error.response.error_description||'Unspecified error.');
			location.href = 'error?' + searchParams.toString() + '#e';
		});	
	}
	
	rule_1()
	{
		var tokens = JSON.parse(localStorage.getItem('tokens') || "[]");
		if( tokens.length == 0 )
		{
			this.hasAccounts = false;
			this.rule_2();
		}
		else
		{
			var self = this;
			var identities = [];
			tokens.forEach((t) => { identities.push(Ajax.post("/oauth/session", {data: {signin_token: t}})); });
			Promise.allSettled(identities).then((responses) =>
			{
				var ids = [];
				for( var i = 0, j = 0; i < responses.length; i++, j++ )
				{
					// clear invalid tokens
					if( responses[i].status == "rejected" )
					{
						tokens.splice(j, 1);
						localStorage.setItem('tokens', JSON.stringify(tokens));
						j--;
					}
					else
					{
						if( !ids.find((x) => x.id == responses[i].value.response.id) )
						{
							responses[i].value.response.token = tokens[j];
							ids.push(responses[i].value.response);
						}
					}
				}
				
				if( ids.length == 0 ) { self.hasAccounts = false; self.rule_2(); }
				else { this.hasAccounts = true; self.rule_1_display(ids); }
			});
		}
	}
	
	rule_1_display(ids)
	{
		var self = this;
		var div = document.getElementById('login_panel');
		while(div.firstChild) div.firstChild.remove();
		
		div.append(
			Node.p(Translator.get("login.choose.account")),
			Node.p({className: 'onbehalf'}, Translator.get("login.provider", safeHtml(this.providerName))),
			Node.ul([
				ids.map((i) => Node.li({className: 'account', dataset: {token: i.token}, click: function() { self.rule_4(this.dataset.token); }}, Node.span(safeHtml(i.name)))),
				Node.li({className: 'other', click: function() { self.rule_2(); div.classList.add('wait'); }}, Translator.get("login.choose.other"))
			])
		);
		div.classList.remove('wait');
	}
	
	rule_2()
	{
		var self = this;
		var div = document.getElementById('login_panel');
		while(div.firstChild) div.firstChild.remove();
		
		Ajax.get("/oidc/local").then((local) =>
		{
			self.forced = self.forced || localStorage.getItem('force_provider');
			Ajax.get("/oidc/providers" + (!!self.forced?'?force='+self.forced:'')).then((response) =>
			{
				self.rule_2_display(response.response.filter((p) => p.id != local.response.id));
			}, (error) =>
			{
				var searchParams = new URLSearchParams();
				searchParams.set("error", error.response.error||'server_error');
				searchParams.set("error_description", error.response.error_description||'Unspecified error.');
				location.href = 'error?' + searchParams.toString() + '#e';
			});
		}, (error) =>
		{
			var searchParams = new URLSearchParams();
			searchParams.set("error", error.response.error||'server_error');
			searchParams.set("error_description", error.response.error_description||'Unspecified error.');
			location.href = 'error?' + searchParams.toString() + '#e';
		});
	}
	
	rule_2_display(providers)
	{
		var self = this;
		var div = document.getElementById('login_panel');
		while(div.firstChild) div.firstChild.remove();
		
		if( providers.length == 0 )
		{
			div.append(Node.p({className: 'error'}, Translator.get('login.error.empty')));
			div.classList.remove('wait');
		}
		else if( providers.length == 1 )
		{
			self.singleProvider = true;
			self.rule_3(providers[0].login_redirect, providers[0].id);
		}
		else
		{
			self.singleProvider = false;
			div.append(
				Node.p(Translator.get("login.choose.provider")),
				Node.p({className: 'onbehalf'}, Translator.get("login.provider", safeHtml(this.providerName))),
			);
			
			if( this.hasAccounts )
				div.append(Node.p({className: 'back', click: function() { self.rule_1(); }}, Translator.get('login.choose.account')));
			
			div.append(
				Node.ul([
					providers.map((p) => Node.li({className: 'provider' + (!!p.login_redirect ? '' : ' password'), dataset: {uri: p.login_redirect, id: p.id}, click: function() { self.rule_3(this.dataset.uri, this.dataset.id); }}, Node.span(safeHtml(p.name)))),
				])
			);
			div.classList.remove('wait');
		}
	}
	
	rule_3(uri, id)
	{
		if( uri && uri != "null" )
			location.href = uri;
		else
			this.rule_3_display(id);
	}
	
	rule_3_display(id)
	{
		var self = this;
		var div = document.getElementById('login_panel');
		while(div.firstChild) div.firstChild.remove();
		div.classList.remove('wait');
		
		Node.append(div, 
		[
			Node.p(Translator.get("login.auth.password")),
			Node.p({className: 'onbehalf'}, Translator.get("login.provider", safeHtml(this.providerName))),
			!self.forced && !self.singleProvider ? Node.p({className: 'back', click: function() { self.rule_2(); }}, Translator.get('login.choose.provider')) : null,
			Node.input({type: 'text', id: 'form_login', placeholder: Translator.get('login.username')}),
			Node.input({type: 'password', id: 'form_password', placeholder: Translator.get('login.password'), keydown: function(e) { if(this.value.length > 0 && (e.key === 'Enter' || e.keyCode === 13)) this.nextSibling.click(); }}),
			Node.button({className: 'raised', click: function(e)
			{
				e.stopImmediatePropagation();
				e.preventDefault();
				var u = document.getElementById('form_login').value;
				var p = document.getElementById('form_password').value;
				if( !u || !p ) return;
				
				div.classList.add('wait');
				var credentials = JSON.stringify({username: u, password: p});
				div.append(Node.form({id: 'form_form', action: '/oauth/login', method: 'POST', enctype: 'application/x-www-form-urlencoded', style: {display: 'none'}}, [
					Node.input({type: 'hidden', value: self.code, name: 'code'}),
					Node.input({type: 'hidden', value: id, name: 'provider'}),
					Node.input({type: 'hidden', value: credentials, name: 'credentials'})
				]));
				div.lastChild.submit();
			}}, Translator.get('login.login')),
		]);
	}
	
	rule_4(token)
	{
		var div = document.getElementById('login_panel');
		while(div.firstChild) div.firstChild.remove();
		div.classList.remove('wait');
		
		var credentials = JSON.stringify({signin_token: token});
		div.append(Node.form({id: 'form_form', action: '/oauth/login', method: 'POST', enctype: 'application/x-www-form-urlencoded', style: {display: 'none'}}, [
			Node.input({type: 'hidden', value: this.code, name: 'code'}),
			Node.input({type: 'hidden', value: credentials, name: 'credentials'})
		]));
		div.lastChild.submit();
	}
}

const page = new LoginPage();
export { page as default };