<script lang="ts" module>
	import { asset } from '$app/paths';

	type O3dv = typeof import('online-3d-viewer');
	let o3dv: Promise<O3dv> | null = null;

	/**
	 * Loads online-3d-viewer (three.js included, ~1 MB) on first use only. Its STEP/IGES importer
	 * occt-import-js is served from `static/occt-import-js/` (copied there by vite.config.ts)
	 * through a small patch (`patches/online-3d-viewer@*.patch`) instead of from a CDN.
	 */
	function loadViewer(): Promise<O3dv> {
		if (!o3dv) {
			// Cast: the files are copied at build time, so they may not exist when types are generated.
			const url = (file: string) =>
				new URL(asset(`occt-import-js/${file}` as Parameters<typeof asset>[0]), location.href).href;
			(globalThis as { O3DV_OCCT_URLS?: Record<string, string> }).O3DV_OCCT_URLS = {
				worker: url('occt-import-js-worker.js'),
				js: url('occt-import-js.js'),
				wasm: url('occt-import-js.wasm')
			};
			o3dv = import('online-3d-viewer').catch((error) => {
				o3dv = null;
				throw error;
			});
		}
		return o3dv;
	}
</script>

<script lang="ts">
	let { src, name, height }: { src: string; name: string; height: string } = $props();

	let container = $state<HTMLDivElement>();
	let status = $state<'loading' | 'ready' | 'error'>('loading');
	let message = $state('');

	$effect(() => {
		const element = container;
		const url = src;
		const fileName = name;
		if (!element || !url) return;

		let cancelled = false;
		let viewer: InstanceType<O3dv['EmbeddedViewer']> | null = null;
		const observer = new ResizeObserver(() => viewer?.Resize());
		status = 'loading';
		message = '';

		(async () => {
			try {
				const [OV, response] = await Promise.all([loadViewer(), fetch(url)]);
				if (!response.ok) throw new Error(`Failed to load the model (${response.status}).`);
				const blob = await response.blob();
				if (cancelled) return;
				viewer = new OV.EmbeddedViewer(element, {
					backgroundColor: new OV.RGBAColor(0, 0, 0, 0),
					defaultColor: new OV.RGBColor(180, 180, 180),
					edgeSettings: new OV.EdgeSettings(false, new OV.RGBColor(0, 0, 0), 1),
					onModelLoaded: () => {
						if (!cancelled) status = 'ready';
					},
					onModelLoadFailed: () => {
						if (cancelled) return;
						status = 'error';
						message = 'This 3D model could not be loaded.';
					}
				});
				observer.observe(element);
				viewer.LoadModelFromFileList([new File([blob], fileName)]);
			} catch (error) {
				if (cancelled) return;
				status = 'error';
				message = error instanceof Error ? error.message : 'Failed to load the 3D viewer.';
			}
		})();

		return () => {
			cancelled = true;
			observer.disconnect();
			viewer?.Destroy();
			element.replaceChildren();
		};
	});
</script>

<div class="relative w-full" style="height: {height};">
	<!-- online-3d-viewer owns this element's children (canvas and progress text). -->
	<div
		bind:this={container}
		class="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground"
	></div>
	{#if status === 'error'}
		<div
			class="absolute inset-0 flex items-center justify-center bg-background/80 p-4 text-center text-sm text-destructive"
		>
			{message}
		</div>
	{/if}
</div>
