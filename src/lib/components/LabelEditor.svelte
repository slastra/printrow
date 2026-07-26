<script lang="ts">
	import { onMount } from 'svelte';
	import type Konva from 'konva';
	import { editor } from '$lib/template/editor.svelte';
	import { data } from '$lib/template/data.svelte';
	import { buildNode, fitBarcode, type KonvaNS } from '$lib/template/nodes';
	import { ELEMENT_META } from '$lib/template/elements';
	import {
		DOTS_PER_MM,
		MIN_SIZE,
		MIN_FONT_SIZE,
		MAX_FONT_SIZE,
		type AnyElement
	} from '$lib/template/schema';
	import { clamp } from '$lib/utils';
	import { Button } from '$lib/components/ui/button';
	import MinusIcon from '@lucide/svelte/icons/minus';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import ScanIcon from '@lucide/svelte/icons/scan';

	const ZOOM_STEPS = [0.5, 0.75, 1, 1.5, 2, 3, 4, 5, 6];

	let root = $state<HTMLDivElement>();
	let viewport = $state<HTMLDivElement>();
	let container: HTMLDivElement;
	let panning = $state(false);
	let spaceHeld = false;
	let K = $state<KonvaNS>();
	let stage: Konva.Stage | undefined;
	let layer: Konva.Layer | undefined;
	let uiLayer: Konva.Layer | undefined;
	let tr: Konva.Transformer | undefined;
	let marqueeRect: Konva.Rect | undefined;
	// Konva owns node state mid-gesture; rebuilding under the pointer would
	// yank the object out of the user's hand.
	let gesture = false;
	let buildGen = 0;
	// nodes + start positions of the whole selection while one member is dragged
	let dragStarts: Map<string, { node: Konva.Shape; x: number; y: number }> | null = null;
	let marqueeFrom: { x: number; y: number; additive: boolean } | null = null;

	// Desktop-first fit: default zoom fills the available width; +/− override.
	let zoomChoice = $state<'fit' | number>('fit');
	let fitZoom = $state(1.5);
	const zoom = $derived(zoomChoice === 'fit' ? fitZoom : zoomChoice);

	// The stage is always white paper, even when the app is in dark mode — so
	// take whichever of the theme's primary pair is darker. In shadcn neutral
	// that's --primary in light mode and --primary-foreground in dark, keeping
	// handles on-palette and visible in both.
	function handleColor(): string {
		const cs = getComputedStyle(document.documentElement);
		const primary = cs.getPropertyValue('--primary').trim();
		const fg = cs.getPropertyValue('--primary-foreground').trim();
		const lightness = (c: string) => Number(/oklch\(\s*([\d.]+)/.exec(c)?.[1] ?? 0.5);
		return (lightness(primary) <= lightness(fg) ? primary : fg) || '#171717';
	}

	onMount(() => {
		let disposed = false;
		(async () => {
			const mod = await import('konva');
			if (disposed) return;
			K = mod.default;
			stage = new K.Stage({
				container,
				width: editor.template.width * zoom,
				height: editor.template.height * zoom,
				scale: { x: zoom, y: zoom }
			});
			// no background layer: the stock colour is painted by the DOM element
			// under the (transparent) canvas, which keeps it plainly reactive
			// Images and barcodes are baked 1-bit at exact dot size; smoothing
			// would blur the zoomed preview into gray the printer can't produce.
			layer = new K.Layer({ imageSmoothingEnabled: false });
			stage.add(layer);
			// selection UI above content, in its own layer
			uiLayer = new K.Layer();
			stage.add(uiLayer);
			const color = handleColor();
			tr = new K.Transformer({
				// free rotation with magnetic snaps at the eighth-turns
				rotationSnaps: [0, 45, 90, 135, 180, 225, 270, 315],
				rotationSnapTolerance: 5,
				// mirror-flips make no sense for label elements, and negative
				// scale mid-gesture corrupts the live width/height folding
				flipEnabled: false,
				ignoreStroke: true,
				borderStroke: color,
				// dotted selection outline, matching the marquee
				borderDash: [4, 4],
				anchorStroke: color,
				anchorCornerRadius: 2,
				anchorSize: 8
			});
			uiLayer.add(tr);
			// Once an element is selected the transformer covers it, so a
			// double-click lands on the handles rather than the node beneath and
			// never reaches its own handler. Select-then-double-click is the
			// natural way to reach for editing, so answer it here too.
			tr.on('dblclick dbltap', () => {
				const one = editor.single;
				if (one) editor.requestEdit(one.id);
			});
			// The selection border must survive solid-black elements: stroke a
			// white underlay first, then the themed dash on top — the classic
			// marching-ants two-tone. The Transformer draws its border via an
			// internal '.back' shape, so restyle its sceneFunc directly.
			const back = tr.findOne<Konva.Shape>('.back');
			if (back) {
				back.sceneFunc((ctx, shape) => {
					const c = (ctx as unknown as { _context: CanvasRenderingContext2D })._context;
					const w = shape.width(),
						h = shape.height();
					c.save();
					c.beginPath();
					c.rect(0, 0, w, h);
					if (tr?.rotateEnabled()) {
						c.moveTo(w / 2, 0);
						c.lineTo(w / 2, -tr.rotateAnchorOffset());
					}
					c.lineWidth = 1;
					c.setLineDash([]);
					c.strokeStyle = '#ffffff';
					c.stroke();
					c.setLineDash([4, 4]);
					c.strokeStyle = (shape.stroke() as string) || '#171717';
					c.stroke();
					c.restore();
				});
				// keep hit detection on the Konva context API — raw strokeStyle
				// writes would corrupt the hit graph's color keys
				back.hitFunc((ctx, shape) => {
					ctx.beginPath();
					ctx.rect(0, 0, shape.width(), shape.height());
					ctx.fillStrokeShape(shape);
				});
			}
			marqueeRect = new K.Rect({
				visible: false,
				stroke: color,
				strokeWidth: 1,
				strokeScaleEnabled: false,
				dash: [4, 4],
				fill: 'rgba(128, 128, 128, 0.12)',
				listening: false
			});
			uiLayer.add(marqueeRect);

			stage.on('mousedown touchstart', (e) => {
				if (e.target !== stage || !stage) return;
				const pos = stage.getPointerPosition();
				if (!pos) return;
				const evt = e.evt as MouseEvent | TouchEvent;
				marqueeFrom = { ...pos, additive: 'shiftKey' in evt && evt.shiftKey };
			});
			stage.on('mousemove touchmove', () => {
				if (!marqueeFrom || !stage || !marqueeRect) return;
				const pos = stage.getPointerPosition();
				if (!pos) return;
				// marquee lives in stage-absolute space; the ui layer is scaled,
				// so convert to label coordinates
				marqueeRect.setAttrs({
					visible: true,
					x: Math.min(marqueeFrom.x, pos.x) / zoom,
					y: Math.min(marqueeFrom.y, pos.y) / zoom,
					width: Math.abs(pos.x - marqueeFrom.x) / zoom,
					height: Math.abs(pos.y - marqueeFrom.y) / zoom
				});
				uiLayer?.batchDraw();
			});
			stage.on('mouseup touchend', finishMarquee);
		})();
		// pointer released outside the canvas still ends the marquee
		window.addEventListener('pointerup', finishMarquee);
		// mode-watcher flips the `dark` class on <html>; recolor the handles live
		const themeObserver = new MutationObserver(() => {
			const c = handleColor();
			tr?.borderStroke(c);
			tr?.anchorStroke(c);
			marqueeRect?.stroke(c);
			uiLayer?.batchDraw();
		});
		themeObserver.observe(document.documentElement, {
			attributes: true,
			attributeFilter: ['class']
		});
		const ro = new ResizeObserver(refit);
		if (root) ro.observe(root);
		return () => {
			disposed = true;
			window.removeEventListener('pointerup', finishMarquee);
			themeObserver.disconnect();
			ro.disconnect();
			stage?.destroy();
		};
	});

	// fit zoom tracks the workspace and media size — both axes, leaving
	// headroom for the floating toolbar (top) and insert bar (bottom)
	function refit() {
		if (!root) return;
		// mobile stacks the bottom controls into two rows, so it needs more
		// headroom reserved than the desktop single row
		const chrome = window.innerWidth >= 1024 ? 140 : 200;
		const w = root.clientWidth - 48;
		const h = root.clientHeight - chrome;
		fitZoom = clamp(Math.min(w / editor.template.width, h / editor.template.height), 0.25, 6);
	}

	// media change → refit
	$effect(() => {
		void editor.template.width;
		void editor.template.height;
		refit();
	});

	// zoom / media → stage geometry
	$effect(() => {
		const w = editor.template.width,
			h = editor.template.height,
			z = zoom;
		if (!stage) return;
		stage.width(w * z);
		stage.height(h * z);
		stage.scale({ x: z, y: z });
		stage.batchDraw();
	});

	function finishMarquee() {
		if (!marqueeFrom || !stage || !marqueeRect || !layer || !K) return;
		const from = marqueeFrom;
		marqueeFrom = null;
		const box = {
			x: marqueeRect.x() * zoom,
			y: marqueeRect.y() * zoom,
			width: marqueeRect.width() * zoom,
			height: marqueeRect.height() * zoom
		};
		marqueeRect.visible(false);
		uiLayer?.batchDraw();
		if (box.width < 4 && box.height < 4) {
			// a click on empty paper
			if (!from.additive) editor.clearSelection();
			return;
		}
		const hits = layer
			.getChildren()
			.filter((n) => K!.Util.haveIntersection(box, n.getClientRect()))
			.map((n) => n.id());
		editor.setSelection(from.additive ? [...editor.selectedIds, ...hits] : hits);
	}

	// Konva selectors aren't CSS — a UUID starting with a digit breaks the
	// '#id' syntax, so match ids directly.
	function nodeById(id: string): Konva.Shape | undefined {
		return layer?.getChildren().find((n): n is Konva.Shape => n.id() === id);
	}

	function errorNode(k: KonvaNS, el: AnyElement): Konva.Shape {
		// Invalid barcode data (e.g. letters in an EAN-13) — visible, not fatal.
		return new k.Text({
			id: el.id,
			x: el.x,
			y: el.y,
			width: el.w,
			text: '⚠ invalid barcode data',
			fontSize: 14,
			fill: '#b91c1c'
		});
	}

	function wire(node: Konva.Shape) {
		node.draggable(true);
		node.on('mousedown touchstart', (e) => {
			const evt = e.evt as MouseEvent | TouchEvent;
			const toggle = 'shiftKey' in evt && (evt.shiftKey || evt.ctrlKey || evt.metaKey);
			editor.select(node.id(), { toggle });
		});
		node.on('dragstart transformstart', () => (gesture = true));
		node.on('dragstart', () => {
			// remember every selected node and where it began, so the rest of
			// the selection follows without re-scanning the layer per pointer event
			if (editor.selectedIds.length > 1 && editor.selectedIds.includes(node.id())) {
				dragStarts = new Map(
					editor.selectedIds.flatMap((id) => {
						const n = nodeById(id);
						return n ? [[id, { node: n, x: n.x(), y: n.y() }] as const] : [];
					})
				);
			}
		});
		node.on('dragmove', () => {
			if (!dragStarts) return;
			const start = dragStarts.get(node.id());
			if (!start) return;
			const dx = node.x() - start.x,
				dy = node.y() - start.y;
			for (const [id, s] of dragStarts) {
				if (id === node.id()) continue;
				s.node.position({ x: s.x + dx, y: s.y + dy });
			}
		});
		node.on('dragend', () => {
			gesture = false;
			if (dragStarts) {
				for (const [id, s] of dragStarts) {
					editor.updateGeometry(id, { x: s.node.x(), y: s.node.y() });
				}
				dragStarts = null;
			} else {
				editor.updateGeometry(node.id(), { x: node.x(), y: node.y() });
			}
		});
		node.on('transform', () => {
			// Content must not stretch while a single-axis handle is dragged —
			// fold the scale into the box live so it reflows instead: text
			// re-wraps, barcodes re-snap their module grid. Fold ONLY the axis
			// the anchor controls, and only for a single-node selection: doing
			// it mid-gesture in a multi transform fights the Transformer's
			// group bbox math. Corners keep Konva's uniform scale preview.
			if (editor.selectedIds.length !== 1) return;
			const el = editor.byId(node.id());
			if (!el || !ELEMENT_META[el.type].reflowsOnAxisResize) return;
			const anchor = tr?.getActiveAnchor();
			if (anchor === 'middle-left' || anchor === 'middle-right') {
				node.setAttrs({ width: Math.max(MIN_SIZE, node.width() * node.scaleX()), scaleX: 1 });
			} else if (anchor === 'top-center' || anchor === 'bottom-center') {
				node.setAttrs({ height: Math.max(MIN_SIZE, node.height() * node.scaleY()), scaleY: 1 });
			} else {
				return;
			}
			if (el.type === 'barcode') {
				const base = node.getAttr('barcodeBase') as HTMLCanvasElement | undefined;
				if (base) {
					(node as Konva.Image).image(
						fitBarcode(base, { ...el, w: Math.round(node.width()), h: Math.round(node.height()) })
					);
				}
			}
		});
		node.on('transformend', () => {
			gesture = false;
			const el = editor.byId(node.id());
			const scaleX = node.scaleX();
			const scaleY = node.scaleY();
			const w = node.width() * scaleX;
			const h = node.height() * scaleY;
			node.scale({ x: 1, y: 1 });
			// Corner drags (keepRatio: both axes scale) resize the type itself;
			// single-axis drags from the side/top/bottom anchors resize only the
			// box — that's what lets shrink-to-fit react to the box getting
			// smaller than its content.
			if (
				el?.type === 'text' &&
				ELEMENT_META.text.cornerScalesFont &&
				scaleX !== 1 &&
				scaleY !== 1
			) {
				// clamp here: the model funnel rejects (not clamps) invalid values
				editor.updateById(node.id(), {
					fontSize: clamp(Math.round(el.fontSize * scaleY), MIN_FONT_SIZE, MAX_FONT_SIZE)
				});
			}
			editor.updateGeometry(node.id(), {
				x: node.x(),
				y: node.y(),
				w,
				h,
				rotation: node.rotation()
			});
		});
		// every type reveals its properties; the Inspector decides what to focus
		node.on('dblclick dbltap', () => editor.requestEdit(node.id()));
	}

	// model → nodes: full rebuild. A label holds a dozen elements; simplicity
	// beats incremental diffing at this scale.
	$effect(() => {
		// deep-reads the elements for effect tracking and yields a plain clone —
		// unlike a JSON round-trip, embedded image dataUrls aren't re-encoded
		const els = $state.snapshot(editor.template.elements) as AnyElement[];
		// with a CSV loaded and preview on, the canvas shows the preview row's
		// real values; otherwise the raw {{placeholders}} stay visible
		const values = data.previewValues;
		const k = K;
		if (!k || !layer) return;
		const gen = ++buildGen;
		(async () => {
			// elements are independent; build them concurrently (order preserved)
			const nodes = await Promise.all(
				els.map((el) => buildNode(k, el, values).catch(() => errorNode(k, el)))
			);
			if (gen !== buildGen || !layer || !tr || gesture) return;
			layer.destroyChildren();
			for (const node of nodes) {
				wire(node);
				layer.add(node);
			}
			syncTransformer();
			layer.batchDraw();
		})();
	});

	// selection → transformer
	$effect(() => {
		void editor.selectedIds;
		if (K) syncTransformer();
	});

	function syncTransformer() {
		if (!stage || !tr) return;
		const nodes = editor.selectedIds.map(nodeById).filter((n): n is Konva.Shape => Boolean(n));
		tr.nodes(nodes);
		if (nodes.length === 1) {
			const el = editor.byId(nodes[0].id());
			// per-type: text keeps font and box in step, images/barcodes keep
			// aspect, boxes stretch freely. Side anchors always stretch freely.
			tr.keepRatio(el ? ELEMENT_META[el.type].keepAspect : true);
		} else {
			tr.keepRatio(true);
		}
		uiLayer?.batchDraw();
	}

	function stepZoom(dir: 1 | -1) {
		const current = zoom;
		const next =
			dir === 1
				? ZOOM_STEPS.find((s) => s > current + 0.01)
				: [...ZOOM_STEPS].reverse().find((s) => s < current - 0.01);
		if (next !== undefined) zoomChoice = next;
	}

	/**
	 * Pan the workspace with the middle button, or space + drag. Left-drag is
	 * reserved for marquee selection, so panning takes the gestures design
	 * tools reserve for it.
	 */
	function startPan(e: PointerEvent) {
		if (!viewport) return;
		if (e.button !== 1 && !(e.button === 0 && spaceHeld)) return;
		e.preventDefault();
		panning = true;
		const startX = e.clientX,
			startY = e.clientY;
		const fromLeft = viewport.scrollLeft,
			fromTop = viewport.scrollTop;
		const move = (m: PointerEvent) => {
			viewport?.scrollTo({
				left: fromLeft - (m.clientX - startX),
				top: fromTop - (m.clientY - startY)
			});
		};
		const up = () => {
			panning = false;
			window.removeEventListener('pointermove', move);
			window.removeEventListener('pointerup', up);
		};
		window.addEventListener('pointermove', move);
		window.addEventListener('pointerup', up);
	}

	function onKeydown(e: KeyboardEvent) {
		const t = e.target as HTMLElement;
		if (
			t instanceof HTMLInputElement ||
			t instanceof HTMLTextAreaElement ||
			t instanceof HTMLSelectElement ||
			t.isContentEditable
		)
			return;
		const mod = e.ctrlKey || e.metaKey;
		const key = e.key.toLowerCase();
		if (mod && key === 'z' && !e.shiftKey) {
			e.preventDefault();
			editor.undo();
		} else if ((mod && key === 'z' && e.shiftKey) || (mod && key === 'y')) {
			e.preventDefault();
			editor.redo();
		} else if (mod && key === 'a') {
			e.preventDefault();
			editor.selectAll();
		} else if (mod && key === 'g') {
			e.preventDefault();
			if (e.shiftKey) editor.ungroupSelection();
			else editor.groupSelection();
		} else if (mod && key === 'd') {
			e.preventDefault();
			editor.duplicateSelection();
		} else if (e.key === ']') {
			editor.raise();
		} else if (e.key === '[') {
			editor.lower();
		} else if (e.key === 'Delete' || e.key === 'Backspace') {
			e.preventDefault();
			editor.remove();
		} else if (e.key === 'Escape') {
			editor.clearSelection();
		} else if (e.key.startsWith('Arrow') && editor.selectedIds.length) {
			e.preventDefault();
			const step = e.shiftKey ? DOTS_PER_MM : 1; // shift = 1 mm
			const [dx, dy] = {
				ArrowLeft: [-step, 0],
				ArrowRight: [step, 0],
				ArrowUp: [0, -step],
				ArrowDown: [0, step]
			}[e.key] ?? [0, 0];
			editor.nudge(dx, dy);
		}
	}
</script>

<svelte:window
	onkeydown={(e) => {
		if (e.code === 'Space') spaceHeld = true;
		onKeydown(e);
	}}
	onkeyup={(e) => {
		if (e.code === 'Space') spaceHeld = false;
	}}
	onblur={() => (spaceHeld = false)}
/>

<div bind:this={root} class="absolute inset-0">
	<!--
		grid + *-safe centering: plain centering (m-auto / place-content-center)
		pushes overflow past the scroll container's start edge, so a zoomed-in
		label can't be scrolled back to its top-left. `safe` falls back to
		start alignment exactly when the content stops fitting.
		Middle-drag or space-drag pans; the wheel scrolls as usual.
	-->
	<!-- svelte-ignore a11y_no_static_element_interactions -- panning is a
	     pointer-only affordance; the canvas is reachable by keyboard already -->
	<div
		bind:this={viewport}
		class="absolute inset-0 grid content-center-safe justify-center-safe overflow-auto p-6 {panning
			? 'cursor-grabbing select-none'
			: ''}"
		onpointerdown={startPan}
	>
		<!-- the label is paper, not UI: no border, a real object's shadow.
		     w-fit/h-fit matter: as a stretched grid item this box would be sized
		     to the viewport and its overflow-hidden would clip the zoomed canvas
		     instead of letting the scroll container see it. -->
		<!-- the stock colour is painted here, under the transparent canvas -->
		<div
			class="h-fit w-fit overflow-hidden paper-surface"
			style="background: {editor.template.stockColor}; border-radius: {editor.template.stockRadius >
			0
				? editor.template.stockRadius + '%'
				: '2px'}"
		>
			<div bind:this={container}></div>
		</div>
	</div>
	<div
		class="absolute right-3 bottom-16 z-10 flex float-in-up flex-col-reverse items-center gap-0.5 tool-surface p-1 lg:bottom-3 lg:flex-row lg:gap-1"
		style="animation-delay: 240ms"
	>
		<Button variant="ghost" size="icon" class="size-7" onclick={() => stepZoom(-1)}>
			<MinusIcon />
		</Button>
		<!-- vertical rail has no room for the percentage; the fit action stays,
		     as an icon, so zoom is still resettable on a phone -->
		<button
			class="flex size-7 items-center justify-center text-muted-foreground hover:text-foreground lg:size-auto lg:w-12 lg:text-xs lg:tabular-nums"
			onclick={() => (zoomChoice = 'fit')}
			title="Fit to window"
		>
			<ScanIcon class="size-3.5 lg:hidden" />
			<span class="hidden lg:inline">{Math.round(zoom * 100)}%</span>
			<span class="sr-only">Fit to window</span>
		</button>
		<Button variant="ghost" size="icon" class="size-7" onclick={() => stepZoom(1)}>
			<PlusIcon />
		</Button>
	</div>
</div>
