<script lang="ts">
	import { DownloadIcon } from '@lucide/svelte';
	import { PDFViewer } from '@embedpdf/viewer-svelte';
	import ModelViewer from './model-viewer.svelte';
	import type { PreviewSource } from './types.ts';

	type Props = {
		/** What to show; null shows `emptyText`. */
		preview: PreviewSource | null;
		height: string;
		emptyText?: string;
	};

	let { preview, height, emptyText = 'Nothing selected.' }: Props = $props();

	/** Text previews show at most this many characters. */
	const MAX_TEXT = 200_000;

	let text = $state<{ src: string; content: string; error: string } | null>(null);

	$effect(() => {
		if (preview?.kind !== 'text' || !preview.src) return;
		const src = preview.src;
		let cancelled = false;
		text = { src, content: '', error: '' };
		fetch(src)
			.then((response) => {
				if (!response.ok) throw new Error(`Failed to load the file (${response.status}).`);
				return response.text();
			})
			.then((content) => {
				if (cancelled) return;
				text = {
					src,
					content:
						content.length > MAX_TEXT ? `${content.slice(0, MAX_TEXT)}\n\n… (truncated)` : content,
					error: ''
				};
			})
			.catch((error: unknown) => {
				if (cancelled) return;
				text = {
					src,
					content: '',
					error: error instanceof Error ? error.message : 'Failed to load the file.'
				};
			});
		return () => {
			cancelled = true;
		};
	});
</script>

{#snippet message(content: string)}
	<div
		class="flex items-center justify-center p-4 text-center text-sm text-muted-foreground"
		style="height: {height};"
	>
		{content}
	</div>
{/snippet}

{#if !preview || !preview.src}
	{@render message(emptyText)}
{:else if preview.kind === 'pdf'}
	<PDFViewer
		src={preview.src}
		theme={{ preference: 'system', accent: '#7c3aed' }}
		style="height: {height}; width: 100%;"
	/>
{:else if preview.kind === 'image' || preview.kind === 'svg'}
	<div
		class={[
			'flex items-center justify-center',
			preview.kind === 'svg'
				? // #001023 is the board background of KiCad's default PCB editor theme.
					['p-6', preview.background === 'dark' ? 'bg-[#001023]' : 'bg-white']
				: 'p-2'
		]}
		style="height: {height};"
	>
		<!-- KiCad SVGs have a tiny intrinsic size in mm, so scale them up to fill the pane. -->
		<img
			src={preview.src}
			alt={preview.name}
			class={preview.kind === 'svg'
				? 'h-full w-full object-contain'
				: 'max-h-full max-w-full object-contain'}
		/>
	</div>
{:else if preview.kind === '3d'}
	{#key preview.src}
		<ModelViewer src={preview.src} name={preview.name} {height} />
	{/key}
{:else if preview.kind === 'text'}
	{#if text?.src !== preview.src || (!text.content && !text.error)}
		{@render message('Loading…')}
	{:else if text.error}
		{@render message(text.error)}
	{:else}
		<pre
			class="overflow-auto p-3 font-mono text-xs whitespace-pre-wrap"
			style="height: {height};">{text.content}</pre>
	{/if}
{:else}
	<div
		class="flex flex-col items-center justify-center gap-2 p-4 text-center text-sm text-muted-foreground"
		style="height: {height};"
	>
		<span>No preview for this file type.</span>
		<a
			href={preview.src}
			download={preview.name}
			target="_blank"
			rel="noopener"
			class="inline-flex items-center gap-1 font-medium text-foreground underline underline-offset-4"
		>
			<DownloadIcon class="size-4" />
			Download {preview.name}
		</a>
	</div>
{/if}
