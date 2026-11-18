<script lang="ts">
	import type { Snippet } from 'svelte';
	import AttachmentPreview from './attachment-preview.svelte';
	import type { PreviewSource } from './types.ts';

	type Props = {
		/** Heading, e.g. the selected record's name; empty shows `placeholder`. */
		title: string;
		/** Secondary line under the title, e.g. the library. */
		detail?: string;
		preview: PreviewSource | null;
		/** Shown in the preview area when `preview` is null. */
		emptyText: string;
		/** Shown as the heading when nothing is selected. */
		placeholder?: string;
		height?: string;
		/** Controls on the right of the heading (e.g. a 2D/3D switch). */
		actions?: Snippet;
		/** Extra content under the heading (e.g. pin counts). */
		children?: Snippet;
		class?: string;
	};

	let {
		title,
		detail = '',
		preview,
		emptyText,
		placeholder = 'Nothing selected',
		height = '24rem',
		actions,
		children,
		class: className
	}: Props = $props();
</script>

<!-- A side or below-table panel around the shared AttachmentPreview, e.g. on master-data pages. -->
<aside class={['flex min-w-0 flex-col gap-3 rounded-md border p-3', className]}>
	<div class="flex items-start justify-between gap-2">
		<div class="min-w-0">
			<h2 class={['truncate text-base font-semibold', !title && 'text-muted-foreground']}>
				{title || placeholder}
			</h2>
			{#if detail}<p class="truncate text-sm text-muted-foreground">{detail}</p>{/if}
		</div>
		{@render actions?.()}
	</div>
	{@render children?.()}
	<div class="overflow-hidden rounded-md border bg-muted/20">
		<AttachmentPreview {preview} {height} {emptyText} />
	</div>
</aside>
