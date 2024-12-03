
let ae = globalThis.ae;
var x = new Promise((ok, nok) =>
{
	ae.require('Page', 'Node', 'Ajax', 'Translator', 'Notify', 'Modal', 'Entity', 'page.workflow.css').then(([Page, Node, Ajax, Translator, Notify, Modal, Entity]) =>
	{
		var page = new Page();
		Object.assign(page, 
		{
			show: function()
			{
				this.dom.classList.add('workflow');
				document.body.querySelectorAll('nav li').forEach(e => { if( e.dataset.link == 'workflow') e.classList.add('selected'); else e.classList.remove('selected'); });
				
				var id = ae.urlValue('flow');
				if( id ) this.initFlow(id);
				else this.initList();
				
				return Promise.resolve();
			},
			
			hide: function()
			{
				while(this.dom.firstChild) this.dom.firstChild.remove();
				
				delete this.mode;
				delete this.dragTarget;
				delete this.dragParent;
				delete this.flowSize;
				delete this.cellSize;
				delete this.isDrag;
				delete this.isDown;
				delete this.data;
				
				return Promise.resolve(); 
			},
			
			// ========================
			//
			// FLOW LIST
			//
			// ========================
			
			initList: function()
			{
				var self = this;
				while(this.dom.firstChild) this.dom.firstChild.remove();
				
				this.dom.append(
					Node.div({className: 'search'}, [
						Node.input({type: 'search', input: function()
						{
							self.filter(this.value);
						}}),
						Node.span({className: 'icon'}, 'search')
					]),
					Node.h1(Translator.get('workflow.title')),
					Node.p(Translator.get('workflow.explain')),
					Node.div({className: 'action'}, Node.button({className: 'raised', click: function(e)
					{
						e.preventDefault();
						Modal.prompt(Translator.get('workflow.create.name')).then((form) =>
						{
							self.dom.classList.add('wait');
							Ajax.post('/api/meta/entity/aeonics.entity.flow/aeonics.entity.flow', 
								{data: {data: JSON.stringify({name: form.value.value})}}).then((result) => 
							{
								self.dom.classList.remove('wait');
								if( result.response.id )
									location.href = '#workflow?flow=' + result.response.id;
								else
									self.refreshList();
							}, (error) =>
							{
								Notify.error(Translator.get('workflow.create.error'));
								self.dom.classList.remove('wait');
							});
						}, () => {});
					}}, 
					[
						Node.span({className: 'icon'}, 'create'),
						Translator.get('create')
					])),
					Node.ol({id: 'flowList'})
				);
				
				this.refreshList();
			},
			
			filter: function(value)
			{
				var words = (value||'').split(/\s+/g).map(w => new RegExp((w||'').replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'), 'i'));
				
				[].slice.call(this.dom.querySelectorAll('#flowList li')).forEach(p =>
				{
					if( !value || value.length == 0 ) { p.classList.remove('hidden'); return; }
					
					for (var w = 0; w < words.length; w++)
					{
						if( !words[w].test(p.firstChild.textContent) )
						{
							p.classList.add('hidden');
							return;
						}
					}
					p.classList.remove('hidden');
				});
			},
			
			refreshList: function()
			{
				var self = this;
				var list = this.dom.querySelector('#flowList');
				while(list.firstChild) list.firstChild.remove();
				list.classList.add('wait');
				
				Ajax.get('/api/meta/registry/aeonics.entity.flow/entities').then((result) =>
				{
					list.classList.remove('wait');
					if( result.response.length == 0 )
					{
						list.append(Node.p(Translator.get('workflow.empty')));
						return;
					}
					
					result.response
						.sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()))
						.forEach(f =>
						{
							list.append(Node.li({dataset: {id: f.id, name: f.name}}, 
							[
								Node.h2([
									Node.span({click: function() { location.href = '#workflow?flow='+this.closest('li').dataset.id; }}, ae.safeHtml(f.name)),
									Node.div({className: 'actions'},
									[
										Node.span({click: function() { self.removeFlow(this.closest('li').dataset.id, this.closest('li').dataset.name); }, title: Translator.get('remove')}, 'close'),
										Node.span({click: function() { location.href = '#workflow?flow='+this.closest('li').dataset.id; }, title: Translator.get('edit')}, 'edit')
									])
								]),
								(!!f.parameters.notes ? Node.p(ae.safeHtml(f.parameters.notes)) : null)
							]));
						});
				}, (error) =>
				{
					Notify.error(Translator.get('fetch.error'));
					list.classList.remove('wait');
				});
			},
			
			removeFlow: function(id, name)
			{
				var self = this;
				Modal.confirm(Translator.get('workflow.remove.confirm', ae.safeHtml(name)), [Translator.get('remove'), Translator.get('cancel')]).then((index) =>
				{
					if( index > 0 ) return;
					
					self.dom.classList.add('wait');
					Ajax.delete('/api/meta/entity/aeonics.entity.flow/' + encodeURIComponent(id)).then(() =>
					{
						self.dom.classList.remove('wait');
						Notify.success(Translator.get('workflow.remove.success'));
						self.refreshList();
					}, (error) =>
					{
						Notify.error(Translator.get('workflow.remove.error'));
						self.dom.classList.remove('wait');
					});
				}, () => {});
			},
			
			// ========================
			//
			// SPECIFIC FLOW
			//
			// ========================
			
			initFlow: function(id)
			{
				var self = this;
				while(this.dom.firstChild) this.dom.firstChild.remove();
				this.dom.classList.add('wait');
				
				Ajax.get('/api/meta/flow/' + encodeURIComponent(id)).then((result) =>
				{
					self.initFlow2(result.response);
				}, (error) =>
				{
					self.dom.classList.remove('wait');
					Notify.error(Translator.get('fetch.error'));
					location.href = '#workflow';
				});
			},
			
			initFlow2: function(data)
			{
				this.data = data;
				
				var self = this;
				this.dom.append(
					Node.div({className: 'flowTitle'},
					[
						Node.span({click: function() { location.href = '#workflow'; }}, 'arrow_back'),
						Node.span({click: function() { self.infoFlow(); }}, 'info'),
						Node.p(ae.safeHtml(data.name))
					]),
					
					Node.div({id: 'flowAddButton', click: function() { self.addEntity(); }}, 'add'),
					
					Node.div({className: 'controls'}, [
						Node.span({click: function() { self.zoom(1); }}, 'add'),
						Node.span({click: function() { self.zoom(-1); }}, 'remove'),
						Node.span({click: function() { 
							self.zoom(0);
							self.center();
						}}, 'center_focus_strong'),
						Node.span({click: function() { this.parentNode.nextSibling.classList.toggle('flat'); }}, '3d_rotation')
					]),
					
					Node.div({className: 'mouseTarget',
						mousedown: function(e) { self.down(e); },
						mouseup: function(e) { self.up(e); },
						mouseleave: function(e) { self.up(e); },
						dragstart: function(e) { e.preventDefault(); return false; },
						wheel: function(e) { e.preventDefault(); self.zoom(-e.deltaY); }}, 
						Node.div({className: 'plane'}, 
							Node.div({className: 'zoomTarget'},
								Node.div({className: 'flow', style: {'--size': data.size}},
								[
									Node.aside({className: 'resizeHandle'}),
									data.entities.map(e => Node.div(
										{id: '_'+e.id, className: 'item', 
											style: {'--row': e.y, '--column': e.x}, 
											dataset: {tooltip: e.name}, 
											mouseenter: function(e) { self.showTooltip(this, e); },
											mouseleave: function(e) { self.hideTooltip(); },
											down: function(e) { self.hideTooltip(); }}, 
										Node.span(e.icon)
									))
								])
							)
						)
					)
				);
				
				self.dom.classList.remove('wait');
				requestAnimationFrame(() =>
				{
					self.refreshConnections();
					self.center();
				});
			},
			
			// ========================
			//
			// MOUSE INTERACTIONS
			//
			// ========================
			
			center: function()
			{
				var p = this.dom.querySelector('.plane');
				var offset = (this.dom.clientHeight - p.clientHeight) / 2;
				p.style.transform = `translate(0, ${offset}px)`;
			},
			
			zoom: function(factor)
			{
				let p = this.dom.querySelector('.zoomTarget');
				
				const style = window.getComputedStyle(p);
				const matrix = new DOMMatrixReadOnly(style.transform === 'none' ? 'matrix(1, 0, 0, 1, 0, 0)' : style.transform);

				let currentScale = matrix.a;

				if( factor === 0 ) currentScale = 1;
				else currentScale = Math.max(0.2, Math.min(1.5, currentScale * (factor < 0 ? 0.7 : 1.4)));
				
				p.style.transform = `scale(${currentScale})`;
			},
			
			down: function(event) 
			{
				// ==== identify drag mode
				let target = event.target.closest("aside") || event.target.closest("div");
				if( !target ) return;
				if( target.classList.contains('item') )
				{
					this.mode = 'item';
					this.dragTarget = target;
					this.dragParent = this.dom.querySelector('.flow');
					this.flowSize = parseInt(this.dom.querySelector('.flow').style.getPropertyValue('--size'));
				}
				else if( target.classList.contains('resizeHandle') )
				{
					this.mode = 'resize';
					this.dragTarget = target;
					this.dragParent = this.dom.querySelector('.mouseTarget');
					this.flowSize = parseInt(this.dom.querySelector('.flow').style.getPropertyValue('--size'));
					this.cellSize = this.dom.querySelector('.plane').clientHeight / this.flowSize;
				}
				else
				{
					this.mode = 'plane';
					this.dragTarget = this.dom.querySelector('.plane');
					this.dragParent = this.dom.querySelector('.mouseTarget');
				}
				
				if( !this.dragTarget || !this.dragParent ) return;
				
				// ==== save current coords
				this.l = this.dragTarget.offsetLeft;
				this.t = this.dragTarget.offsetTop;
				this.ox = this.l + event.offsetX;
				this.oy = this.t + event.offsetY;
				this.px = event.pageX;
				this.py = event.pageY;
				
				// ==== set the signal for down
				this.isDown = true;
				var self = this;
				this.dragParent.addEventListener('mousemove', function(e) { self.move(e); });
			},
			
			move: function(event) 
			{
				if( !this.isDown ) return;
				
				if( this.isDrag )
				{
					// ==== already in drag mode
					if( this.mode == 'item' ) return this.moveItem(event);
					else if( this.mode == 'resize' ) return this.moveResize(event);
					else return this.movePlane(event);
				}
				
				// wait for some move before conclude to a drag
				if( Math.abs(event.pageX - this.px) > 5 || Math.abs(event.pageY - this.py) > 5 )
				{
					this.isDrag = true;
					//return this.move(event);
				}
			},
			
			moveResize: function(event)
			{
				this.dragTarget.classList.add('dragging');
				this.dom.querySelector('.flow').classList.add('dragging');
				this.dom.querySelector('.flow').classList.add('resizing');
				let dy = Math.round((event.pageY - this.py) / this.cellSize);
				this.dom.querySelector('.flow').style.setProperty('--size', Math.min(15, Math.max(4, this.flowSize + dy)));
			},
			
			movePlane: function(event)
			{
				this.dragTarget.classList.add('dragging');
				const matrix = new DOMMatrixReadOnly(window.getComputedStyle(this.dragTarget).transform);
	
				let dx = event.pageX - this.px;
				let dy = event.pageY - this.py;
				
				this.px = event.pageX;
				this.py = event.pageY;
				
				let t = matrix.m42 + dy;
				let l = matrix.m41 + dx;
				
				t = Math.min(this.dragParent.clientHeight - 150, Math.max(-this.dragParent.clientHeight + 150, t));
				l = Math.min(this.dragParent.clientWidth - 150, Math.max(-this.dragParent.clientWidth + 150, l));
				
				this.dragTarget.style.transform = `translate(${l}px, ${t}px)`;
			},
			
			moveItem: function(event)
			{
				this.dragTarget.classList.add('dragging');
				this.dragParent.classList.add('dragging');
				
				// if move target is the item then the offset is wrong. so we first set 'dragging' to disable pointer-events on the
				// target and thus only get the move for the parent :)
				if( event.target !== this.dragParent ) return;
				
				let x2 = event.offsetX;
				let y2 = event.offsetY;

				let l2 = Math.min(
					this.dragParent.offsetWidth - this.dragTarget.offsetWidth, 
					Math.max(0, this.l + (x2 - this.ox))
					);
				let t2 = Math.min(
					this.dragParent.offsetHeight - this.dragTarget.offsetHeight, 
					Math.max(0, this.t + (y2 - this.oy))
					);
					
				// snap to grid
				let gw = this.dragParent.offsetWidth / this.flowSize;
				let gh = this.dragParent.offsetHeight / this.flowSize;
				l2 = Math.round(Math.round(l2 / gw) * gw / this.dragParent.offsetWidth * this.flowSize);
				t2 = Math.round(Math.round(t2 / gh) * gh / this.dragParent.offsetHeight * this.flowSize);
				
				this.dragTarget.style.setProperty('--column', Math.max(0, Math.min(this.flowSize, l2)));
				this.dragTarget.style.setProperty('--row', Math.max(0, Math.min(this.flowSize, t2)));
			},
			
			up: function(event)
			{
				if( !this.isDown ) return;
				var isClick = !this.isDrag;
				if( isClick )
				{
					// this is a click then
					if( this.mode == 'item' )
						this.infoItem(this.dragTarget);
					else if( this.mode == 'plane' && event.target.classList.contains('connector') )
						this.infoLink(event.target);
				}
				
				this.isDown = false;
				this.isDrag = false;
				if( this.dragTarget ) this.dragTarget.classList.remove('dragging');
				if( this.dragParent ) this.dragParent.classList.remove('dragging');
				this.dragTarget = null;
				this.dragParent = null;
				
				if( isClick ) { this.mode = null; return; }
				
				if( this.mode == 'item' )
				{
					this.refreshConnections();
					this.save();
				}
				else if( this.mode == 'resize' )
				{
					this.dom.querySelector('.flow').classList.remove('resizing');
					let flowSize = parseInt(this.dom.querySelector('.flow').style.getPropertyValue('--size'));
					this.dom.querySelectorAll('.item').forEach((i) =>
					{
						let r = i.style.getPropertyValue('--row');
						let c = i.style.getPropertyValue('--column');
						if( parseInt(i.style.getPropertyValue('--row')) > flowSize-1 )
							i.style.setProperty('--row', flowSize-1);
						if( parseInt(i.style.getPropertyValue('--column')) > flowSize-1 )
							i.style.setProperty('--column', flowSize-1);
					});
					this.refreshConnections();
					this.save();
				}
				this.mode = null;
			},
			
			showTooltip: function(item, event)
			{
				var e = this.dom.querySelector('#tooltip');
				if( !e )
				{
					e = Node.div({id: 'tooltip'});
					this.dom.append(e);
				}
				e.textContent = item.dataset.tooltip;
				
				var rect = item.getBoundingClientRect();
				e.style.left = rect.x + 'px';
				e.style.top = rect.y + 'px';
			},
			
			hideTooltip: function()
			{
				var e = this.dom.querySelector('#tooltip');
				if( e ) e.remove();
			},
			
			// ========================
			//
			// RELATIONSHIPS
			//
			// ========================
			
			refreshConnections: function()
			{
				this.dom.querySelector('.flow').classList.add('dragging');
				var self = this;
				setTimeout(() =>
				{
					self.data.links.forEach(l => 
						self.connect(self.dom.querySelector('#_'+l.from.id), self.dom.querySelector('#_'+l.to.id))
					);
					self.dom.querySelector('.flow').classList.remove('dragging');
				}, 200);
			},
			
			connect: function(a, b)
			{
				if( !a || !b ) return;
				var self = this;
				
				// Calculate the centers of both elements
				const centerX1 = a.offsetLeft + a.offsetWidth / 2;
				const centerY1 = a.offsetTop + a.offsetHeight / 2;
				const centerX2 = b.offsetLeft + b.offsetWidth / 2;
				const centerY2 = b.offsetTop + b.offsetHeight / 2;

				// Calculate the distance and angle between the centers
				const deltaX = centerX2 - centerX1;
				const deltaY = centerY2 - centerY1;
				const distance = Math.sqrt(deltaX ** 2 + deltaY ** 2);
				const angle = Math.atan2(deltaY, deltaX) * (180 / Math.PI);

				// Create and style the connecting div
				var line = document.getElementById(a.id + "/" + b.id);
				if( !line )
					line = Node.div({id: a.id + "/" + b.id, className: "connector", dataset: {from: a.id, to: b.id}});
				line.style.width = `${distance}px`;
				line.style.left = `${centerX1}px`;
				line.style.transform = `rotate(${angle}deg) translateZ(0)`;

				this.dom.querySelector('.flow').appendChild(line);
				
				// Adjust `top` so the line's height is centered
				const lineHeight = parseFloat(getComputedStyle(line).height);
				line.style.top = `${centerY1 - lineHeight / 2}px`;
			},
			
			// ========================
			//
			// INFOS
			//
			// ========================
			
			infoFlow: function()
			{
				var self = this;
				Modal.prompt(Translator.get('workflow.flow.edit'), Node.form(
				[
					Node.input({name: 'name', type: 'text', value: this.data.name, placeholder: Translator.get('workflow.flow.name')}),
					Node.textarea({name: 'notes', placeholder: Translator.get('workflow.flow.description')}, this.data.notes)
				])).then((form) =>
				{
					var data = {name: form.name.value, parameters: {notes: form.notes.value}};
					
					self.dom.classList.add('wait');
					Ajax.put('/api/meta/entity/aeonics.entity.flow/' + encodeURIComponent(self.data.id), 
						{data: {data: JSON.stringify(data)}}).then((result) => 
					{
						self.dom.classList.remove('wait');
						Notify.success(Translator.get('workflow.flow.success'));
						self.dom.querySelector('.flowTitle p').textContent = form.name.value;
					}, (error) =>
					{
						self.dom.classList.remove('wait');
						Notify.error(Translator.get('workflow.flow.error'));
					});
				}, () => {});
			},
			
			infoLink: function(div)
			{
				// TODO
				console.log("info link");
			},
			
			infoItem: function(div)
			{
				// TODO
				console.log("info item");
			},
			
			addEntity: function()
			{
				var self = this;
				var m = Modal.custom(
					Node.ul({className: 'chooseElementType'}, 
					[
						Node.li({click: function() { m.ok(); self.addEntity2('aeonics.entity.origin'); }},
							[Node.span('cloud_upload'), Node.p(Translator.get('workflow.origin'))]),
						Node.li({click: function() { m.ok(); self.addEntity2('aeonics.entity.topic'); }},
							[Node.span('alt_route'), Node.p(Translator.get('workflow.topic'))]),
						Node.li({click: function() { m.ok(); self.addEntity2('aeonics.entity.queue'); }},
							[Node.span('stacks'), Node.p(Translator.get('workflow.queue'))]),
						Node.li({click: function() { m.ok(); self.addEntity2('aeonics.entity.action'); }},
							[Node.span('settings'), Node.p(Translator.get('workflow.action'))]),
						Node.li({click: function() { m.ok(); self.addEntity2('aeonics.entity.destination'); }},
							[Node.span('where_to_vote'), Node.p(Translator.get('workflow.destination'))])
					])
				, true);
			},
			
			addEntity2: function(category)
			{
				var self = this;
				Entity.create(category);
				// TODO
			},
			
			// ========================
			//
			// SAVE
			//
			// ========================
			
			save: function()
			{
				var self = this;
				Ajax.put('/api/meta/flow/' + encodeURIComponent(this.data.id)).then((result) =>
				{
					// TODO
				}, (error) =>
				{
					Notify.warning(Translator.get('workflow.save.error'));
				});
			},
		});
		
		ok(page);
	}, (e) => { nok(e); });
});

export { x as default };