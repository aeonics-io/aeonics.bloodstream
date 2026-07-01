import { Page, Node, Ajax, Translator, Notify, Modal } from 'core';
import { css, safeHtml, urlValue } from 'core';
import Entity from '../Entity.js';
css('page.workflow');

class WorkflowPage extends Page
{
	async show()
	{
		this.dom.classList.add('workflow');
		document.body.querySelectorAll('nav li').forEach(e => { if( e.dataset.link == 'workflow') e.classList.add('selected'); else e.classList.remove('selected'); });

		var id = urlValue('flow');
		if( id ) this.initFlow(id);
		else this.initList();

		return Promise.resolve();
	}

	async hide()
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
	}

	// ========================
	//
	// FLOW LIST
	//
	// ========================

	initList()
	{
		var self = this;
		while(this.dom.firstChild) this.dom.firstChild.remove();
		this.dom.classList.remove('details');

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
	}

	filter(value)
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
	}

	refreshList()
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
							Node.span({click: function() { location.href = '#workflow?flow='+this.closest('li').dataset.id; }}, safeHtml(f.name)),
							Node.div({className: 'actions'},
							[
								f.internal ? null : Node.span({click: function() { self.removeFlow(this.closest('li').dataset.id, this.closest('li').dataset.name); }, title: Translator.get('remove')}, 'close'),
								Node.span({click: function() { location.href = '#workflow?flow='+this.closest('li').dataset.id; }, title: Translator.get(f.readonly ? 'view' : 'edit')}, f.readonly ? 'visibility' : 'edit')
							])
						]),
						(!!f.parameters.notes ? Node.p(safeHtml(f.parameters.notes)) : null)
					]));
				});

			// === ORPHANS
			list.append(Node.li({dataset: {id: "10000000-ffffffffffffffff"}},
				[
					Node.h2([
						Node.span({click: function() { location.href = '#workflow?flow='+this.closest('li').dataset.id; }}, safeHtml(Translator.get("wokflow.orphan.title"))),
						Node.div({className: 'actions'},
						[
							Node.span({click: function() { location.href = '#workflow?flow='+this.closest('li').dataset.id; }, title: Translator.get('edit')}, 'edit')
						])
					]),
					Node.p(Translator.get("wokflow.orphan.explain"))
				]));
		}, (error) =>
		{
			Notify.error(Translator.get('fetch.error'));
			list.classList.remove('wait');
		});
	}

	removeFlow(id, name)
	{
		var self = this;
		Modal.confirm(Translator.get('workflow.remove.confirm', safeHtml(name)), [Translator.get('remove'), Translator.get('cancel')]).then((index) =>
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
	}

	// ========================
	//
	// SPECIFIC FLOW
	//
	// ========================

	refreshFlow()
	{
		this.hide();
		this.initFlow(urlValue('flow'));
	}

	initFlow(id)
	{
		var self = this;
		while(this.dom.firstChild) this.dom.firstChild.remove();
		this.dom.classList.add('wait');
		this.dom.classList.add('details');

		Ajax.get('/api/meta/flow/' + encodeURIComponent(id)).then((result) =>
		{
			self.initFlow2(result.response);
		}, (error) =>
		{
			self.dom.classList.remove('wait');
			Notify.error(Translator.get('fetch.error'));
			location.href = '#workflow';
		});
	}

	initFlow2(data)
	{
		// === ORPHAN
		if( data.id == "10000000-ffffffffffffffff" )
		{
			data.size = Math.max(5, Math.ceil(Math.sqrt(data.entities.length)));
			data.name = Translator.get("wokflow.orphan.title");
			var i = 0;
			data.entities.forEach(e => { e.x = i % data.size; e.y = Math.floor(i / data.size); i++; });
		}

		this.data = data;

		var self = this;
		this.dom.append(
			Node.div({className: 'flowTitle'},
			[
				Node.span({click: function() { location.href = '#workflow'; }}, 'arrow_back'),
				(data.id == "10000000-ffffffffffffffff" ? null : Node.span({click: function() { self.infoFlow(); }}, 'info')),
				Node.p(safeHtml(data.name))
			]),

			Node.div({id: 'flowSidePanel'},
			[
				Node.aside({click: function(e)
				{
					this.parentNode.classList.remove('open');
					self.dom.querySelectorAll('.flow .selected').forEach(n => n.classList.remove('selected'));
					self.dom.querySelectorAll('.flow .preselected').forEach(n => n.classList.remove('preselected'));
				}, title: Translator.get('close')}, 'close'),
				Node.div({className: 'content'})
			]),

			Node.div({className: 'controls'}, [
				Node.span({click: function() { self.zoom(1); }}, 'add'),
				Node.span({click: function() { self.zoom(-1); }}, 'remove'),
				Node.span({click: function() {
					self.zoom(0);
					self.center();
				}}, 'center_focus_strong'),
				Node.span({click: function() { self.dom.querySelector('.mouseTarget').classList.toggle('flat'); }}, '3d_rotation')
			]),

			Node.div({className: 'controls tools'}, [
				Node.span({click: function() { self.addEntity(); }}, 'library_add'),
				Node.span({click: function() { self.addLink(); }}, 'link')
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
									dataset: {tooltip: e.name, id: e.id, category: e.category},
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
	}

	// ========================
	//
	// MOUSE INTERACTIONS
	//
	// ========================

	center()
	{
		var p = this.dom.querySelector('.plane');
		var offset = (this.dom.clientHeight - p.clientHeight) / 2;
		p.style.transform = `translate(0, ${offset}px)`;
	}

	zoom(factor)
	{
		let p = this.dom.querySelector('.zoomTarget');

		const style = window.getComputedStyle(p);
		const matrix = new DOMMatrixReadOnly(style.transform === 'none' ? 'matrix(1, 0, 0, 1, 0, 0)' : style.transform);

		let currentScale = matrix.a;

		if( factor === 0 ) currentScale = 1;
		else currentScale = Math.max(0.2, Math.min(1.5, currentScale * (factor < 0 ? 0.7 : 1.4)));

		p.style.transform = `scale(${currentScale})`;
	}

	down(event)
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
	}

	move(event)
	{
		if( !this.isDown ) return;
		if( this.data.readonly ) return;

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
		}
	}

	moveResize(event)
	{
		this.dragTarget.classList.add('dragging');
		this.dom.querySelector('.flow').classList.add('dragging');
		this.dom.querySelector('.flow').classList.add('resizing');
		let dy = Math.round((event.pageY - this.py) / this.cellSize);
		this.dom.querySelector('.flow').style.setProperty('--size', Math.min(15, Math.max(4, this.flowSize + dy)));
	}

	movePlane(event)
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
	}

	moveItem(event)
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
	}

	up(event)
	{
		if( !this.isDown ) return;
		var isClick = !this.isDrag;
		if( isClick )
		{
			this.dom.querySelectorAll('.flow .selected').forEach(n => n.classList.remove('selected'));
			this.dom.querySelectorAll('.flow .preselected').forEach(n => n.classList.remove('preselected'));
			this.dom.querySelector('#flowSidePanel').classList.remove('open');

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
	}

	showTooltip(item, event)
	{
		var e = this.dom.querySelector('#tooltip');
		if( !e )
		{
			e = Node.div({id: 'tooltip'});
			this.dom.append(e);
		}
		e.textContent = item.dataset.tooltip;

		var rect = item.getBoundingClientRect();
		e.style.left = rect.x + (rect.width / 2) + 'px';
		e.style.top = rect.y + rect.height + 'px';
	}

	hideTooltip()
	{
		var e = this.dom.querySelector('#tooltip');
		if( e ) e.remove();
	}

	// ========================
	//
	// RELATIONSHIPS
	//
	// ========================

	refreshConnections()
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
	}

	connect(a, b)
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
			line = Node.div({id: a.id + "/" + b.id, className: "connector", dataset: {from: a.dataset.id, to: b.dataset.id}});
		line.style.width = `${distance}px`;
		line.style.left = `${centerX1}px`;
		line.style.transform = `rotate(${angle}deg) translateZ(0)`;

		this.dom.querySelector('.flow').appendChild(line);

		// Adjust `top` so the line's height is centered
		const lineHeight = parseFloat(getComputedStyle(line).height);
		line.style.top = `${centerY1 - lineHeight / 2}px`;
	}

	// ========================
	//
	// INFOS
	//
	// ========================

	infoFlow()
	{
		var self = this;
		Modal.prompt(Translator.get('workflow.flow.edit'), Node.form(
		[
			Node.input({name: 'name', type: 'text', value: this.data.name, readOnly: !!this.data.readonly, placeholder: Translator.get('workflow.flow.name')}),
			Node.textarea({name: 'notes', readOnly: !!this.data.readonly, placeholder: Translator.get('workflow.flow.description')}, this.data.notes)
		])).then((form) =>
		{
			if( self.data.readonly ) return;

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
	}

	infoLink(div)
	{
		// TODO : edit

		var self = this;

		var p = document.getElementById('flowSidePanel');
		p.scrollTop = 0;
		p.classList.add('open');
		p.classList.add('wait');
		var content = p.lastChild;
		while( content.firstChild ) content.firstChild.remove();

		var from = this.data.entities.find(e => e.id == div.dataset.from);
		var to = this.data.entities.find(e => e.id == div.dataset.to);

		Promise.all([
			Ajax.get('/api/meta/entity/aeonics.entity.step/' + encodeURIComponent(from.id)),
			Ajax.get('/api/meta/entity/template/aeonics.entity.step/' + encodeURIComponent(from.id)),
			Ajax.get('/api/meta/entity/aeonics.entity.step/' + encodeURIComponent(to.id)),
			Ajax.get('/api/meta/entity/template/aeonics.entity.step/' + encodeURIComponent(to.id))
		]).then((results) =>
		{
			p.classList.remove('wait');
			div.classList.add('selected');
			document.getElementById('_' + from.id).classList.add('preselected');
			document.getElementById('_' + to.id).classList.add('preselected');

			Object.entries(results[0].response.relationships).sort((a, b) => a[0].toLowerCase().localeCompare(b[0].toLowerCase()))
				.forEach(([name, r]) =>
				{
					if( r.length == 0 ) return;

					r.filter(x => x.id == to.id)
					.forEach(x =>
					{
						content.append(self.infoLink2(
							results[0].response,
							results[1].response,
							results[2].response,
							results[3].response,
							name, x));
					});
				});
		}, (error) =>
		{
			p.classList.remove('open');
			p.classList.remove('wait');
			Notify.error(Translator.get('fetch.error'));
		});
	}

	infoLink2(from, from_template, to, to_template, relation, data)
	{
		var self = this;
		var from_channel = from_template.outputs[data.output];
		var to_channel = to_template.inputs[data.input];
		var properties = Object.entries(from_template.relations[relation].parameters)
			.filter(([name, data]) => name != 'id' && name != 'input' && name != 'output');

		return Node.div({className: 'linkinfo'},
		[
			Node.table(
			[
				Node.tbody(Node.tr(
				[
					Node.td(
					[
						Node.div([
							Node.span({className: 'itemicon'}, safeHtml(from_template.icon)),
							Node.p(safeHtml(from.name))
						]),
						Node.span({className: 'channel'}, safeHtml(from_channel.summary))
					]),
					Node.td({className: 'has_in'}),
					Node.td(
					[
						Node.span({className: 'channel'}, safeHtml(to_channel.summary)),
						Node.div([
							Node.span({className: 'itemicon'}, safeHtml(to_template.icon)),
							Node.p(safeHtml(to.name))
						])
					])
				]))
			]),

			Node.section({className: 'link_entity'},
			[
				Node.h2({click: function() { this.parentNode.classList.toggle('open'); }},
				[
					Node.span(Translator.get('workflow.link.from')),
					Node.span({className: 'itemicon'}, safeHtml(from_template.icon)),
					Node.span(safeHtml(from.name))
				]),
				Node.div(Node.div({className: 'detail'}, [
					Node.p([
						Node.span({className: 'title'}, Translator.get('workflow.entity.id')),
						Node.span({className: 'value'}, Node.a({href: '#home?entity=' + from.id}, safeHtml(from.id)))
					]),
					Node.p([
						Node.span({className: 'title'}, Translator.get('workflow.entity.summary')),
						Node.span({className: 'value'}, safeHtml(from_template.summary))
					]),
					Node.p([
						Node.span({className: 'title'}, Translator.get('workflow.entity.description')),
						Node.span({className: 'value'}, safeHtml(from_template.description))
					]),
					Node.p([
						Node.span({className: 'title'}, Translator.get('workflow.entity.channel.out')),
						Node.span({className: 'text'}, safeHtml(from_channel.description))
					])
				]))
			]),
			Node.section({className: 'link_entity'},
			[
				Node.h2({click: function() { this.parentNode.classList.toggle('open'); }},
				[
					Node.span(Translator.get('workflow.link.to')),
					Node.span({className: 'itemicon'}, safeHtml(to_template.icon)),
					Node.span(safeHtml(to.name))
				]),
				Node.div(Node.div({className: 'detail'}, [
					Node.p([
						Node.span({className: 'title'}, Translator.get('workflow.entity.id')),
						Node.span({className: 'value'}, Node.a({href: '#home?entity=' + to.id}, safeHtml(to.id)))
					]),
					Node.p([
						Node.span({className: 'title'}, Translator.get('workflow.entity.summary')),
						Node.span({className: 'value'}, safeHtml(to_template.summary))
					]),
					Node.p([
						Node.span({className: 'title'}, Translator.get('workflow.entity.description')),
						Node.span({className: 'value'}, safeHtml(to_template.description))
					]),
					Node.p([
						Node.span({className: 'title'}, Translator.get('workflow.entity.channel.in')),
						Node.span({className: 'text'}, safeHtml(to_channel.description))
					])
				]))
			]),
			properties.length == 0 ? null : Node.section({className: 'link_entity'},
			[
				Node.h2({click: function() { this.parentNode.classList.toggle('open'); }},
				[
					Node.span(Translator.get('workflow.link.properties'))
				]),
				Node.div(Node.div({className: 'properties'},
					properties.map(([name, detail]) =>
					{
						return Node.fieldset(
						[
							Node.label({htmlFor: 'entity__' + name}, safeHtml(detail.summary)),
							Entity.__getField(name, detail, data[name]),
							Node.p(safeHtml(detail.description))
						])
					})))
			]),

			Node.button({className: 'sensitive', click: function(x)
			{
				x.preventDefault();
				Modal.confirm(Translator.get('workflow.link.remove.confirm', safeHtml(from.name), safeHtml(to.name)), [Translator.get('remove'), Translator.get('cancel')]).then((index) =>
				{
					if( index > 0 ) { return; }

					Ajax.delete("/api/meta/flow/link", {data: {from: from.id, to: to.id, output: from_channel.name, input: to_channel.name}}).then((result) =>
					{
						Notify.success(Translator.get('workflow.link.remove.success'));
						self.refreshFlow();
					}, (error) =>
					{
						Notify.error(Translator.get('workflow.link.remove.error'));
					});
				}, () => {});
			}}, Translator.get('remove'))
		]);
	}

	infoItem(div)
	{
		var self = this;

		var p = document.getElementById('flowSidePanel');
		p.scrollTop = 0;
		p.classList.add('open');
		p.classList.add('wait');
		var content = p.lastChild;
		while( content.firstChild ) content.firstChild.remove();

		Promise.all([
			Ajax.get('/api/meta/entity/aeonics.entity.step/' + encodeURIComponent(div.dataset.id)),
			Ajax.get('/api/meta/entity/template/aeonics.entity.step/' + encodeURIComponent(div.dataset.id))
		]).then((results) =>
		{
			p.classList.remove('wait');
			div.classList.add('selected');

			var e = results[0].response;
			var t = results[1].response;

			content.append(
				Node.h1(safeHtml(e.name)),

				Node.table({},
				[
					Node.tbody(Node.tr(
					[
						Node.td(
							Object.entries(t.inputs||{}).map(([name, detail]) => [
							Node.span({className: 'channel'}, safeHtml(detail.summary)),
							Node.br()
							])),
						Node.td({className: ((Object.entries(t.inputs||{}).length > 0) ? 'has_in' : '') + ((Object.entries(t.outputs||{}).length > 0) ? ' has_out' : '')},
							Node.span({className: 'itemicon'}, safeHtml(t.icon))),
						Node.td(Object.entries(t.outputs||{}).map(([name, detail]) => [
							Node.span({className: 'channel'}, safeHtml(detail.summary)),
							Node.br()
							]))
					]))
				]),

				// === entity description
				Node.section({className: 'open'},
				[
					Node.h2({click: function() { this.parentNode.classList.toggle('open'); }},
					[
						Node.span(Translator.get('workflow.entity.info'))
					]),
					Node.div(Node.div({className: 'detail'}, [
						Node.p([
							Node.span({className: 'title'}, Translator.get('workflow.entity.id')),
							Node.span({className: 'value'}, Node.a({href: '#home?entity=' + e.id}, safeHtml(e.id)))
						]),
						Node.p([
							Node.span({className: 'title'}, Translator.get('workflow.entity.summary')),
							Node.span({className: 'value'}, safeHtml(t.summary))
						]),
						Node.p([
							Node.span({className: 'title'}, Translator.get('workflow.entity.description')),
							Node.span({className: 'text'}, safeHtml(t.description))
						])
					]))
				]),

				// === entity channels
				Node.section(
				[
					Node.h2({click: function() { this.parentNode.classList.toggle('open'); }},
					[
						Node.span(Translator.get('workflow.entity.channels'))
					]),
					Node.div(Node.div({className: 'detail'},
					[
						Object.entries(t.inputs||{}).length + Object.entries(t.outputs||{}).length == 0 ? Node.p({className: 'empty'}, Translator.get('workflow.entity.channels.empty')) : null,
						Object.entries(t.inputs||{}).map(([name, detail]) =>
						{
							return [
								Node.p([
									Node.span({className: 'title'}, Translator.get('workflow.entity.channel.name')),
									Node.span({className: 'value'},
									[
										Node.span({className: 'channel'}, safeHtml(detail.summary)),
										Node.span({className: 'icon', click: function()
										{
											document.getElementById('flowSidePanel').firstChild.click(); // click on close icon
											self.addLink(null, null, {icon: t.icon, name: e.name, id: e.id}, detail);
										}}, 'link')
									])
								]),
								Node.p([
									Node.span({className: 'title'}, Translator.get('workflow.entity.channel.direction')),
									Node.span({className: 'value'}, Translator.get('workflow.entity.channel.in'))
								]),
								Node.p([
									Node.span({className: 'title'}, Translator.get('workflow.entity.channel.description')),
									Node.span({className: 'text'}, safeHtml(detail.description))
								]),
								Node.hr()
// TODO : channel properties (via "t")
							];
						}),
						Object.entries(t.outputs||{}).map(([name, detail]) =>
						{
							return [
								Node.p([
									Node.span({className: 'title'}, Translator.get('workflow.entity.channel.name')),
									Node.span({className: 'value'},
									[
										Node.span({className: 'channel'}, safeHtml(detail.summary)),
										Node.span({className: 'icon', click: function()
										{
											document.getElementById('flowSidePanel').firstChild.click(); // click on close icon
											self.addLink({icon: t.icon, name: e.name, id: e.id}, detail, null, null);
										}}, 'link')
									])
								]),
								Node.p([
									Node.span({className: 'title'}, Translator.get('workflow.entity.channel.direction')),
									Node.span({className: 'value'}, Translator.get('workflow.entity.channel.out'))
								]),
								Node.p([
									Node.span({className: 'title'}, Translator.get('workflow.entity.channel.description')),
									Node.span({className: 'text'}, safeHtml(detail.description))
								]),
								Node.hr()
							]
						})
					]))
				]),

				// === entity config
				Node.section(
				[
					Node.h2({click: function() { this.parentNode.classList.toggle('open'); }},
					[
						Node.span(Translator.get('workflow.entity.properties'))
					]),
					Object.entries(t.parameters||{}).length == 0 ? Node.div(Node.p({className: 'empty'}, Translator.get('workflow.entity.properties.empty'))) :
					Node.div(Node.div({className: 'properties'},
						Object.entries(t.parameters||{}).map(([name, detail]) =>
						{
							return Node.fieldset(
							[
								Node.label({htmlFor: 'entity__' + name}, safeHtml(detail.summary)),
								Entity.__getField(name, detail, e.parameters[name], true),
								Node.p(safeHtml(detail.description))
							]);
						})))
				]),

				Node.button({disabled: !!e.internal, className: 'sensitive', click: function(x)
				{
					x.preventDefault();
					Modal.confirm(Translator.get('entity.edit.remove.confirm', e.name), [Translator.get('remove'), Translator.get('cancel')]).then((index) =>
					{
						if( index > 0 ) { return; }

						Ajax.delete("/api/meta/entity/aeonics.entity.step/" + encodeURIComponent(e.id)).then((result) =>
						{
							Notify.success(Translator.get('entity.edit.remove.success'));
							self.refreshFlow();
						}, (error) =>
						{
							Notify.error(Translator.get('entity.edit.remove.error'));
						});
					}, () => {});
				}}, Translator.get('remove'))
// TODO : if unmapped : move to other flow
			);

		}, (error) =>
		{
			p.classList.remove('open');
			p.classList.remove('wait');
			Notify.error(Translator.get('fetch.error'));
		});
	}

	// ========================
	//
	// ADD
	//
	// ========================

	addLink(step_from, channel_from, step_to, channel_to)
	{
		if( !this.data.entities && this.data.entities.length < 2 )
		{
			Notify.warning(Translator.get('workflow.link.no_entity'));
			return;
		}

		var self = this;
		var m = Modal.custom([
			Node.h2(Translator.get('workflow.add.link')),
			Node.form({className: 'linkbuilder'},
			[
				Node.div({click: function(e)
				{
					e.preventDefault();
					self.chooseLink(1).then(result =>
					{
						while(this.firstChild) this.firstChild.remove();
						if( !result ) { this.append(Node.p(Translator.get('workflow.add.choose'))); return; }

						var e = self.data.entities.find(x => x.id == result.step);
						var c = e.outputs.find(x => x.name == result.channel);
						this.append(Node.div([
							Node.span({className: 'itemicon'}, safeHtml(e.icon)),
							Node.p(safeHtml(e.name)),
							Node.span({className: 'channel'}, safeHtml(c.summary)),
							Node.input({type: 'hidden', name: 'from', value: result.step}),
							Node.input({type: 'hidden', name: 'output', value: result.channel})
						]));

// TODO : link parameters
					}, () => {});
				}},
				[
					(step_from && channel_from) ? Node.div(
					[
						Node.span({className: 'itemicon'}, safeHtml(step_from.icon)),
						Node.p(safeHtml(step_from.name)),
						Node.span({className: 'channel'}, safeHtml(channel_from.summary)),
						Node.input({type: 'hidden', name: 'from', value: step_from.id}),
						Node.input({type: 'hidden', name: 'output', value: channel_from.name})
					]) :
					Node.p(Translator.get('workflow.add.choose'))
				]),
				Node.span('double_arrow'),
				Node.div({click: function(e)
				{
					e.preventDefault();
					self.chooseLink(0).then(result =>
					{
						while(this.firstChild) this.firstChild.remove();
						if( !result ) { this.append(Node.p(Translator.get('workflow.add.choose'))); return; }

						var e = self.data.entities.find(x => x.id == result.step);
						var c = e.inputs.find(x => x.name == result.channel);
						this.append(Node.div([
							Node.span({className: 'itemicon'}, safeHtml(e.icon)),
							Node.p(safeHtml(e.name)),
							Node.span({className: 'channel'}, safeHtml(c.summary)),
							Node.input({type: 'hidden', name: 'to', value: result.step}),
							Node.input({type: 'hidden', name: 'input', value: result.channel})
						]));
					}, () => {});
				}},
				[
					(step_to && channel_to) ? Node.div(
					[
						Node.span({className: 'itemicon'}, safeHtml(step_to.icon)),
						Node.p(safeHtml(step_to.name)),
						Node.span({className: 'channel'}, safeHtml(channel_to.summary)),
						Node.input({type: 'hidden', name: 'from', value: step_to.id}),
						Node.input({type: 'hidden', name: 'output', value: channel_to.name})
					]) :
					Node.p(Translator.get('workflow.add.choose'))
				]),
				Node.section(
				[
					channel_from ? self.getChannelProperties(step_from, channel_from) : null
				])
			]),
			Node.div({className: 'modalbuttons'},
			[
				Node.button({click: function(e) { e.preventDefault(); self._doAddLink(this.parentNode.previousSibling, m); }}, Translator.get('ok')),
				Node.button({click: function(e) { e.preventDefault(); m.nok(); }}, Translator.get('cancel'))
			])
		], true);
	}

	getChannelProperties(step, channel)
	{

	}

	chooseLink(from)
	{
		var self = this;
		var ok, nok;
		var p  = new Promise((_ok, _nok) => { ok = _ok; nok = _nok; });
		p.ok = ok;
		p.nok = nok;
		var m;

		const nodes = this.data.entities.map(e =>
		{
			if( from && e.outputs.length == 0 ) return null;
			else if( !from && e.inputs.length == 0 ) return null;


			return Node.div({className: 'pickchannel', dataset: {id: e.id}}, [
				Node.div([
					Node.span({className: 'itemicon'}, safeHtml(e.icon)),
					Node.p(safeHtml(e.name))
				]),
				Node.div(
					(from?e.outputs:e.inputs).map(c => Node.span(
					{className: 'channel', dataset: {id: c.name}, click: function()
					{
						m.ok();
						p.ok({step: this.parentNode.parentNode.dataset.id, channel: this.dataset.id});
					}},
					safeHtml(c.summary)))
				)
			]);
		}).filter(n => n != null);

		if( nodes.length == 0 )
		{
			Modal.alert(Translator.get('workflow.add.link.empty'));
			p.nok();
			return p;
		}

		m = Modal.custom(nodes, true);
		m.then(() => {}, () => { p.nok(); });
		return p;
	}

	_doAddLink(form, m)
	{
		var self = this;
		if( !form || !form.from || !form.from.value || !form.output || !form.output.value
			|| !form.to || !form.to.value || !form.input || !form.input.value )
		{
			Notify.warning(Translator.get('workflow.add.link.incomplete'));
			return;
		}

		if( form.from.value == form.to.value )
		{
			Notify.warning(Translator.get('workflow.add.link.self'));
			return;
		}

		if( this.data.links.find(l => l.from.id == form.from.value && l.from.output == form.output.value && l.to.id == form.to.value && l.to.input == form.input.value) )
		{
			Notify.warning(Translator.get('workflow.add.link.duplicate'));
			return;
		}

		m.dom.classList.add('wait');
		Ajax.post("/api/meta/flow/link", {data: form}).then((result) =>
		{
			m.ok();
			Notify.success(Translator.get('workflow.add.link.success'));
			self.refreshFlow();
		}, (error) =>
		{
			m.dom.classList.remove('wait');
			Notify.error(Translator.get('workflow.add.link.error'));
		});
	}

	addEntity()
	{
		var self = this;

		var p = document.getElementById('flowSidePanel');
		p.scrollTop = 0;
		p.classList.add('open');
		p.classList.add('wait');
		var content = p.lastChild;
		while( content.firstChild ) content.firstChild.remove();

		Ajax.get('/api/meta/factory/aeonics.entity.step/templates').then((result) =>
		{
			var steps = result.response.sort((a, b) => a.summary.toLowerCase().localeCompare(b.summary.toLowerCase()));
			content.append(
				Node.h1(Translator.get('workflow.add.step')),
				Node.div({className: 'search'},
				[
					Node.input({type: 'search', input: function()
					{
						var value = this.value;
						var words = (value||'').split(/\s+/g).map(w => new RegExp((w||'').replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'), 'i'));

						[].slice.call(this.parentNode.parentNode.querySelectorAll('section li')).forEach(li =>
						{
							if( !value || value.length == 0 ) { li.classList.remove('hidden'); return; }

							for (var w = 0; w < words.length; w++)
							{
								if( !words[w].test(li.firstChild.lastChild.textContent) )
								{
									li.classList.add('hidden');
									return;
								}
							}
							li.classList.remove('hidden');
						});
					}}),
					Node.span({className: 'icon'}, 'search')
				])
			);

			["ORIGIN", "TOPIC", "QUEUE", "ACTION", "DESTINATION"].forEach(role =>
			{
				content.append(Node.section({className: 'open'},
				[
					Node.h2({click: function() { this.parentNode.classList.toggle('open'); }},
					[
						Node.span(Translator.get('workflow.entity.role.' + role))
					]),
					Node.div(Node.ul({className: 'stepList'}, steps.map(step => step.role != role ? null :
						Node.li({dataset: {type: step.type}, click: function() { self.addEntity2(steps.find(s => s.type == this.dataset.type)); }},
						[
							Node.h3(
							[
								Node.span({className: 'itemicon'}, safeHtml(step.icon)),
								Node.span(safeHtml(step.summary))
							]),
							Node.p(safeHtml(step.description))
						])
					)))
				]));
			});

			p.classList.remove('wait');
		}, (error) =>
		{
			Notify.error(Translator.get('workflow.template.error'));
			p.classList.remove('wait');
			p.classList.remove('open');
		});
	}

	addEntity2(template)
	{
		document.getElementById('flowSidePanel').classList.remove('open');

		var self = this;
		var m = Modal.custom(Node.div({id: 'entity_editor'},
		[
			Node.h2(safeHtml(template.summary)),
			Node.form(
			[
				Node.fieldset({className: 'required'}, [
					Node.label({htmlFor: 'entity__name'}, Translator.get('entity.name')),
					Node.input({type: 'text', name: '__name', id: 'entity__name', value: ''})
				]),
				Object.entries(template.parameters).sort((a, b) => a[1].summary.toLowerCase().localeCompare(b[1].summary.toLowerCase())).map(([key, detail]) =>
				{
					return Node.fieldset({className: detail.optional ? '' : 'required'}, [
						Node.label({htmlFor: 'entity__' + key}, safeHtml(detail.summary)),
						Entity.__getField(key, detail),
						Node.p(safeHtml(detail.description))
					])
				}),
				Node.button({click: function(e)
				{
					e.preventDefault();
					m.ok();
				}}, Translator.get('cancel')),
				Node.button({click: function(e)
				{
					e.preventDefault();
					m.dom.classList.add('wait');

					var form = this.parentNode;
					var data = {name: form.__name.value, parameters: {}};
					for( var e of form.elements )
					{
						if( e.name && !e.name.startsWith('__') )
						{
							if( e.type != 'checkbox' || e.checked )
								data.parameters[e.name] = e.value;
						}
					}

					Ajax.post('/api/meta/entity/aeonics.entity.step/' + encodeURIComponent(template.type),
						{data: {data: JSON.stringify(data)}}).then((result) =>
					{
						var flow = self.dom.querySelector('.flow');

						const cell = self.findFreeCell(flow);
						flow.append(Node.div({className: 'item', dataset: {id: result.response.id}, style: {'--row': cell[1], '--column': cell[0]}}));
						self.save().then(() =>
						{
							Notify.success(Translator.get('entity.create.success'));
							m.ok();
							self.refreshFlow();
						});
					}, (error) =>
					{
						Notify.error(Translator.get('entity.create.error'));
						m.dom.classList.remove('wait');
					});
				}}, Translator.get('ok'))
			])
		]), true);
		m.dom.classList.add('promptable');
	}

	findFreeCell(flow)
	{
		var size = parseInt(flow.style.getPropertyValue('--size'));
		var items = [].slice.call(flow.querySelectorAll(".item"));

		const occupied = Array.from({ length: size }, () => Array(size).fill(false));
		items.forEach(i => {
			const row = parseInt(i.style.getPropertyValue('--row'));
			const column = parseInt(i.style.getPropertyValue('--column'));
			if( row >= 0 && row < size && column >= 0 && column < size )
				occupied[row][column] = true;
		});

		for( let row = 0; row < size; row++ )
			for( let column = 0; column < size; column++ )
				if ( !occupied[row][column] )
					return [column, row];
		return [0, 0];
	}

	// ========================
	//
	// SAVE
	//
	// ========================

	save()
	{
		if( this.data.readonly ) return;

		var self = this;
		var data = {
			size: parseInt(this.dom.querySelector('.flow').style.getPropertyValue('--size')),
			entities: [].slice.call(this.dom.querySelectorAll(".item")).map(i => { return {
				id: i.dataset.id,
				x: parseInt(i.style.getPropertyValue('--column')),
				y: parseInt(i.style.getPropertyValue('--row'))};
				})
		};

		return Ajax.put('/api/meta/flow/' + encodeURIComponent(this.data.id), {data: {data: JSON.stringify(data)}}).then((result) =>
		{
		}, (error) =>
		{
			Notify.warning(Translator.get('workflow.save.error'));
		});
	}
}

const page = new WorkflowPage();
export { page as default };
