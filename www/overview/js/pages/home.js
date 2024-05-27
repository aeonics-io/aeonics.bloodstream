
let ae = globalThis.ae;
var x = new Promise((ok, nok) =>
{
	ae.require('Page', 'Node', 'Translator', 'Ajax', 'Notify', 'page.home.css', 'ext/d3-force.min.js', 'ext/d3-quadtree.min.js', 'ext/force-graph.min.js').then(([Page, Node, Translator, Ajax, Notify]) =>
	{
		Translator.load('default').then(() =>
		{
			ok(Object.assign(new Page(), 
			{
				show: function()
				{
					this.dom.classList.add('cellgraph');
					
					this.highlightNodes = new Set();
					this.highlightLinks = new Set();
					this.hoverNode = null;
					this.clickMode = 'highlight';
					
					this.load();
					
					return Promise.resolve();
				},
				
				load: function()
				{
					var self = this;
					
					this.dom.append(
						Node.div({id: 'graph'}),
						Node.div({id: 'modeswitcher', click: function() { self.clickMode = 'info'; }}, "AAAAAAAAAAA"),
						);
					this.getData();
				},
				
				nodeClick: function(node)
				{
					var self = this;
					
					if( this.clickMode == 'highlight' )
					{
						self.highlightNodes.clear();
						self.highlightLinks.clear();
						if (node)
						{
							self.highlightNodes.add(node);
							node.neighbors.forEach(neighbor => self.highlightNodes.add(neighbor));
							node.links.forEach(link => self.highlightLinks.add(link));
						}
						self.hoverNode = node || null;
					}
					else if( this.clickMode == 'info' )
					{
						if( node && node.type == 'e' )
							self.showInfo(node);
					}
				},
				
				showInfo: function(node)
				{
					Ajax.get('/api/meta/entity/' + node.category + '/' + node.id).then((response) =>
					{
						Ajax.get('/api/meta/template', {data: {category: node.category, type: node.subtype}}).then((response) =>
						{
							console.log(response.response);
							Notify.success("OK");
						}, (error) =>
						{
							Notify.error(Translator.get('fetch.error'));
						});
					}, (error) =>
					{
						Notify.error(Translator.get('fetch.error'));
					});
				},
				
				getData: function()
				{
					var self = this;
					Ajax.get('/api/meta/overview').then((response) =>
					{
						self.drawObs(response.response);
					}, (error) =>
					{
						Notify.error(Translator.get('fetch.error'));
					});
				},
				
				fixPosition: function(quadrant, main, nodes)
				{
					var offset = 0;//Math.PI / 4;
					
					var main_distance = 600;
					main.fx = main_distance * Math.cos(quadrant * (Math.PI / 2) - offset);
					main.fy = main_distance * Math.sin(quadrant * (Math.PI / 2) - offset);
					
					var node_distance = 400;
					var node_increment_angle = (Math.PI / 2) / (nodes.length+1);
					var node_start_angle = (quadrant * (Math.PI / 2)) - (Math.PI / 4) - offset;
					
					for( var n = 0; n < nodes.length; n++ )
					{
						nodes[n].fx = node_distance * Math.cos((node_start_angle + ((n+1) * node_increment_angle)));
						nodes[n].fy = node_distance * Math.sin((node_start_angle + ((n+1) * node_increment_angle)));
					}
				},
				
				drawObs: function(data)
				{
					// https://github.com/vasturiano/force-graph
					const graphdata = { nodes: [], links: [] };
					var self = this;
					
					// ===========================
					// REGISTRY
					// ===========================
					
					var node_main = {id: 'registry', name: 'Registry', visible: true, color: '#FB8136', type: 'r0'};
					graphdata.nodes.push(node_main);
					var node_list = [];
					for( const [key, value] of Object.entries(data.registry) )
					{
						var node = {id: 'registry:'+key, name: key, color: '#FB8136', visible: true, type: 'r1'};
						node_list.push(node);
						graphdata.nodes.push(node);
						graphdata.links.push({source: 'registry', target: 'registry:'+key, color: '#FB813680'});
						
						value.forEach(e =>
						{
							graphdata.nodes.push({id: e.id, name: e.name, color: '#E0C200', visible: true, type: 'e', category: key, subtype: e.type});
							graphdata.links.push({source: 'registry:'+key, target: e.id, color: '#FB813640'});
							e.relations.forEach(rel => graphdata.links.push({source: e.id, target: rel, relate: true, color: '#E0C20040'}));
						});
					};
					this.fixPosition(1, node_main, node_list);
					
					// ===========================
					// FACTORY
					// ===========================

					node_main = {id: 'factory', name: 'Factory', visible: true, color: '#36B0FB', type: 'f0'};
					graphdata.nodes.push(node_main);
					node_list = [];
					for( const [key, value] of Object.entries(data.factory) )
					{
						var node = {id: 'factory:'+key, name: key, color: '#36B0FB', visible: true, type: 'f1'};
						node_list.push(node);
						graphdata.nodes.push(node);
						graphdata.links.push({source: 'factory', target: 'factory:'+key, color: '#36B0FB80'});
						
						value.forEach(e =>
						{
							if( data.registry[key] ) data.registry[key].forEach(r =>
							{
								if( r.type == e.type )
									graphdata.links.push({source: 'factory:'+key, target: r.id, creator: true, color: '#36B0FB40'});
							});
						});
					};
					this.fixPosition(3, node_main, node_list);
					
					// ===========================
					// MANAGERS
					// ===========================
					
					node_main = {id: 'manager', name: 'Managers', visible: true, color: '#D21D50', type: 'm0'};
					graphdata.nodes.push(node_main);
					node_list = [];
					for( const [key, value] of Object.entries(data.managers) )
					{
						var node = {id: 'manager:'+key, name: key, color: '#D21D50', visible: true, type: 'm1'};
						node_list.push(node);
						graphdata.nodes.push(node);
						graphdata.links.push({source: 'manager', target: 'manager:'+key, color: '#D21D5080'});
						if( value ) graphdata.links.push({source: 'manager:'+key, target: value, color: '#D21D5040'});
					};
					this.fixPosition(0, node_main, node_list);
					
					// ===========================
					// PLUGINS
					// ===========================
					
					node_main = {id: 'plugin', name: 'Plugins', visible: true, color: '#29C64B', type: 'p0'};
					graphdata.nodes.push(node_main);
					node_list = [];
					data.plugins.forEach(p =>
					{
						var node = {id: 'plugin:'+p, name: p, color: '#29C64B', visible: true, type: 'p1'};
						node_list.push(node);
						graphdata.nodes.push(node);
						graphdata.links.push({source: 'plugin', target: 'plugin:'+p, color: '#29C64B80'});
						
						for( const [key, value] of Object.entries(data.factory) )
						{
							value.forEach(f =>
							{
								if( f.plugin == p )
								{
									data.registry[key].forEach(r =>
									{
										if( r.type == f.type )
											graphdata.links.push({source: 'plugin:'+p, target: r.id, creator: true, color: '#29C64B40'});
									});
								}
							});
						}
					});
					this.fixPosition(2, node_main, node_list);
					
					// ===========================
					// MAP FOR HIGHLIGHT
					// ===========================
					
					graphdata.links.forEach(link => {
						const a = graphdata.nodes.find(n => n.id == link.source);
						const b = graphdata.nodes.find(n => n.id == link.target);
						!a.neighbors && (a.neighbors = []);
						!b.neighbors && (b.neighbors = []);
						a.neighbors.push(b);
						b.neighbors.push(a);

						!a.links && (a.links = []);
						!b.links && (b.links = []);
						a.links.push(link);
						b.links.push(link);
					});
					
					// ===========================
					// IMAGES
					// ===========================
					
					var imgs = {};
					imgs.r0 = new Image(); imgs.r0.src = 'images/registry.png';
					imgs.f0 = new Image(); imgs.f0.src = 'images/factory.png';
					imgs.p0 = new Image(); imgs.p0.src = 'images/plugin.png';
					imgs.m0 = new Image(); imgs.m0.src = 'images/manager.png';
					
					// ===========================
					// GRAPH
					// ===========================
					
					const Graph = ForceGraph()
						(document.getElementById('graph'))
						.linkDirectionalParticles(link => link.relate ? 2 : 0)
						.onNodeDragEnd(node => 
						{
							node.fx = node.x; 
							node.fy = node.y;
						})
						.onBackgroundClick(e =>
						{
							self.highlightNodes.clear();
							self.highlightLinks.clear();
							self.hoverNode = null;
						})
						.onNodeClick(node => 
						{
							if( node.type == 'r0' || node.type == 'f0' || node.type == 'p0' || node.type == 'm0' )
							{
								node.visible = !node.visible;
								graphdata.nodes.forEach(n => {
									if( n.type[0] == node.type[0] )
										n.visible = node.visible;
								});
							}
							else
							{
								self.nodeClick(node);
							}
						})
						.linkWidth(link => self.highlightLinks.has(link) ? 4 : 1)
						.nodeVisibility(n => !!imgs[n.type] || n.visible)
						.linkVisibility(l => (self.highlightLinks.size == 0 || self.highlightLinks.has(l) || l.source.type.endsWith('0')) ? (l.source.visible && l.target.visible) : false)
						.nodeCanvasObject((node, ctx, scale) =>
						{
							var size = 5;
							
							if( imgs[node.type] )
							{
								size = 40;
								ctx.beginPath();
								ctx.arc(node.x, node.y, size, 0, 2 * Math.PI, false);
								ctx.fillStyle = '#1C1B21';
								ctx.strokeStyle = node.color;
								ctx.lineWidth = node === self.hoverNode ? 4 : 2;
								ctx.fill();
								ctx.stroke();
								size = 50;
								ctx.drawImage(imgs[node.type], node.x - size / 2, node.y - size / 2, size, size);
							}
							else if( node.type != 'e' )
							{
								size = 5;
								
								ctx.beginPath();
								ctx.arc(node.x, node.y, size, 0, 2 * Math.PI, false);
								ctx.fillStyle = node.color;
								ctx.strokeStyle = node.color;
								ctx.lineWidth = node === self.hoverNode ? 3 : 1;
								ctx.fill();
								ctx.stroke();
							}
							else
							{
								ctx.beginPath();
								ctx.arc(node.x, node.y, node === self.hoverNode ? 8 : 5, 0, 2 * Math.PI, false);
								ctx.fillStyle = node.color;
								ctx.fill();
							}
						})
						.nodePointerAreaPaint((node, color, ctx) => {
							var size = 5;
							if( imgs[node.type] ) size = 30;
							else size = 8;
							
							ctx.fillStyle = color;
							ctx.fillRect(node.x - size / 2, node.y - size / 2, size, size);
						})
						
						.d3Force('center', null)
						.d3Force('charge', null)
						.d3Force('link', null)
						.d3Force('collide', d3.forceCollide(8))
						.d3Force('radial', d3.forceRadial(200))
						
						.graphData(graphdata)
						;
				}
			}));
		});
	}, (e) => { nok(e); });
});

export { x as default };