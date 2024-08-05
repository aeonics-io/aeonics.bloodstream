
let ae = globalThis.ae;
var x = new Promise((ok, nok) =>
{
	ae.require('App', 'Page', 'Node', 'Translator', 'ae.layout.css').then(([App, Page, Node, Translator]) =>
	{
		ok(Object.assign(new Page(), 
		{
			show: function()
			{
				var self = this;
				var container = Node.main({id: "main_container"});
				
				document.body.append(
					Node.nav(Node.ol({click: (e) => {
						var li = e.target.closest('nav li');
						if( !li ) return;
						
						li.parentNode.querySelectorAll('li').forEach(e => e.classList.remove('selected'));
						li.classList.add('selected');
						location.hash = '#' + li.dataset.link;
					}}, [
						Node.li({className: location.hash == '#home' || location.hash == '' || location.hash == '#' ? 'selected' : '', dataset: {link: 'home'}}, [
							Node.span({className: 'icon'}, 'gps_fixed'), 
							Translator.get('menu.navigate')
						]),
						Node.li({className: location.hash == '#stats' ? 'selected' : '', dataset: {link: 'stats'}}, [
							Node.span({className: 'icon'}, 'equalizer'), 
							Translator.get('menu.statistics')
						]),
						Node.li({className: location.hash == '#esg' ? 'selected' : '', dataset: {link: 'esg'}}, [
							Node.span({className: 'icon'}, 'power'), 
							Translator.get('menu.esg')
						]),
						Node.li({className: location.hash == '#security' ? 'selected' : '', dataset: {link: 'security'}}, [
							Node.span({className: 'icon'}, 'security'), 
							Translator.get('menu.security')
						])
					])),
					container
				);
				
				App.container = container;
				return Promise.resolve(null);
			}
		}));
	}, (e) => { nok(e); });
});

export { x as default };