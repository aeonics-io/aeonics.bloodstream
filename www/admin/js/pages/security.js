
let ae = globalThis.ae;
var x = new Promise((ok, nok) =>
{
	ae.require('Page', 'Node', 'Ajax', 'Translator', 'Notify', 'page.security.css').then(([Page, Node, Ajax, Translator, Notify]) =>
	{
		var page = new Page();
		Object.assign(page, 
		{
			show: function()
			{
				this.dom.classList.add('security');
				document.body.querySelectorAll('nav li').forEach(e => { if( e.dataset.link == 'security') e.classList.add('selected'); else e.classList.remove('selected'); });
				
				this.init();
				return Promise.resolve();
			},
			
			hide: function()
			{
				while(this.dom.firstChild) this.dom.firstChild.remove();
				return Promise.resolve(); 
			},
			
			init: function()
			{
				var self = this;
				this.dom.classList.add('wait');
				while(this.dom.firstChild) this.dom.firstChild.remove();
				
				Ajax.get('/api/meta/probe', {data: {name: 'registry'}}).then((probes) =>
				{
					var entities = parseInt(probes.response.registry.entities);
					
					Ajax.get('/api/meta/integrity').then((result) =>
					{
						self.dom.append(
							Node.h1(Translator.get('security.surface')),
							Node.div({className: 'tab', dataset: {tab: 1}}, [
								Node.div({click: function(e) { self.switchTab(e.target); }}, [
									Node.span(Translator.get('security.surface.plugins')),
									Node.span(Translator.get('security.surface.packages')),
									Node.span(Translator.get('security.surface.code')),
									Node.span(Translator.get('security.surface.entities'))
								]),
								Node.div([
									Node.div({className: 'tabcontent'},
									[
										self.getScore([0, 3, 6, 10, 15, 20, 25, 30], Object.keys(result.response).length, Translator.get('security.surface.plugins.title')),
										Node.p(Translator.get('security.surface.plugins.explain'))
									]),
									Node.div({className: 'tabcontent'},
									[
										self.getScore([0, 20, 50, 80, 120, 200, 300, 500], Object.values(result.response).reduce((a, c) => a+c.packages.length, 0), Translator.get('security.surface.packages.title')),
										Node.p(Translator.get('security.surface.packages.explain'))
									]),
									Node.div({className: 'tabcontent'},
									[
										self.getScore([0, 2, 10, 20, 30, 50, 100, 200], Math.round(Object.values(result.response).reduce((a, c) => a+c.size, 0)/1024/1024*10)/10, Translator.get('security.surface.code.title')),
										Node.p(Translator.get('security.surface.code.explain'))
									]),
									Node.div({className: 'tabcontent'},
									[
										self.getScore([0, 150, 250, 350, 450, 600, 1000, 1500], entities, Translator.get('security.surface.entities.title')),
										Node.p(Translator.get('security.surface.entities.explain'))
									])
								])
							]),
							
							Node.h1(Translator.get('security.integrity')),
							Node.p(Translator.get('security.integrity.explain'))
						);
							
						for( const [name, module] of Object.entries(result.response) )
						{
							self.dom.append(Node.section([
								Node.h2({click: function() { this.parentNode.classList.toggle('open'); }}, ae.safeHtml(name)),
								Node.div(Node.div({className: 'detail'}, [
									Node.p([
										Node.span({className: 'title'}, Translator.get('info.template.summary')),
										Node.span({className: 'text'}, ae.safeHtml(module.summary||''))
									]),
									Node.p([
										Node.span({className: 'title'}, Translator.get('info.template.description')),
										Node.span({className: 'text'}, ae.safeHtml(module.description||''))
									]),
									Node.p([
										Node.span({className: 'title'}, Translator.get('security.file.name')),
										Node.span({className: 'value'}, ae.safeHtml(module.file||''))
									]),
									Node.p([
										Node.span({className: 'title'}, Translator.get('security.file.modified')),
										Node.span({className: 'value'}, !!module.modified ? new Date(module.modified) : "")
									]),
									Node.p([
										Node.span({className: 'title'}, Translator.get('security.file.size')),
										Node.span({className: 'value'}, ae.safeHtml(module.size))
									]),
									Node.p([
										Node.span({className: 'title'}, Translator.get('security.file.hash')),
										Node.span({className: 'value'}, ae.safeHtml(module.hash))
									]),
									Node.p([
										Node.span({className: 'title'}, Translator.get('security.module.packages')),
										Node.span({className: 'value'}, module.packages.map((p) => Node.span({className: 'tag'}, ae.safeHtml(p))))
									]),
									Node.p([
										Node.span({className: 'title'}, Translator.get('security.module.uses')),
										Node.span({className: 'value'}, module.uses.map((p) => Node.span({className: 'tag'}, ae.safeHtml(p))))
									]),
									Node.p([
										Node.span({className: 'title'}, Translator.get('security.module.provides')),
										Node.span({className: 'value'}, module.provides.map((p) => Node.span({className: 'tag'}, ae.safeHtml(p))))
									]),
									Node.p([
										Node.span({className: 'title'}, Translator.get('security.module.requires')),
										Node.span({className: 'value'}, module.requires.map((p) => Node.span({className: 'tag'}, ae.safeHtml(p))))
									]),
									Node.p([
										Node.span({className: 'title'}, Translator.get('security.module.opens')),
										Node.span({className: 'value'}, module.opens.map((p) => Node.span({className: 'tag'}, ae.safeHtml(p))))
									]),
									Node.p([
										Node.span({className: 'title'}, Translator.get('security.module.exports')),
										Node.span({className: 'value'}, module.exports.map((p) => Node.span({className: 'tag'}, ae.safeHtml(p))))
									])
								]))
							]));
						}
						
						self.dom.classList.remove('wait');
					}, (error) =>
					{
						Notify.error(Translator.get('fetch.error'));
					});
				}, (error) =>
				{
					Notify.error(Translator.get('fetch.error'));
				});
			},
			
			switchTab: function(node)
			{
				if( node.nodeName !== 'SPAN' ) return;
				
				var index = Array.prototype.indexOf.call(node.parentNode.childNodes, node) + 1;
				var t = node.parentNode.parentNode;
				t.dataset.tab = index;
				t.classList.toggle('changed');
			},
			
			getScore: function(scales, current, title)
			{
				var previous = scales.shift();
				return Node.div({className: 'score'}, [
					Node.p(title),
					scales.map((s, i) =>
					{
						var letter = String.fromCharCode(65+i);
						var rate = previous + " - " + s;
						var selected = (i == 0 && current < previous) || 
							(i == scales.length - 1 && current > s) ||
							(current > previous && current <= s);
						previous = s;
						
						return Node.div({className: letter + (selected ? ' selected' : '')}, [
							Node.span(rate), 
							Node.span(letter),
							Node.span(selected ? ''+current : '')
						]);
					})
				]);
			}
		});
		
		ok(page);
	}, (e) => { nok(e); });
});

export { x as default };