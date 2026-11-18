<script lang="ts">
	import { Button } from '#lib/components/ui/button/index.js';
	import { pageItems } from './pagination.ts';

	type Props = {
		/** 0-based index of the current page. */
		pageIndex: number;
		pageCount: number;
		onPageChange: (pageIndex: number) => void;
	};

	let { pageIndex, pageCount, onPageChange }: Props = $props();
</script>

<div class="flex items-center justify-between gap-4 border-t p-2">
	<p class="text-sm text-muted-foreground">Page {pageIndex + 1} of {pageCount}</p>
	<div class="flex items-center gap-1">
		{#each pageItems(pageIndex, pageCount) as page, index (`${index}:${page}`)}
			{#if page === 'ellipsis'}
				<span class="px-2 text-muted-foreground">…</span>
			{:else}
				<Button
					size="sm"
					variant={page === pageIndex ? 'default' : 'outline'}
					aria-label={`Go to page ${page + 1}`}
					aria-current={page === pageIndex ? 'page' : undefined}
					onclick={() => onPageChange(page)}
				>
					{page + 1}
				</Button>
			{/if}
		{/each}
	</div>
</div>
