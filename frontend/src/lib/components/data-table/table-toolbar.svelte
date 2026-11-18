<script lang="ts">
	import type { Snippet } from 'svelte';
	import { Input } from '#lib/components/ui/input/index.js';

	type Props = {
		/** Heading text, or a snippet for custom markup. */
		title?: string | Snippet;
		/** Search text. Omit to hide the search input. */
		search?: string;
		onSearch?: (query: string) => void;
		/** Buttons on the right side. */
		actions?: Snippet;
		class?: string;
	};

	let { title, search, onSearch, actions, class: className }: Props = $props();
</script>

<div class={['flex items-center justify-between p-2', className]}>
	<div class="flex justify-start gap-2">
		{#if typeof title === 'string'}
			<h2 class="text-base font-semibold">{title}</h2>
		{:else if title}
			{@render title()}
		{/if}
		{#if search !== undefined}
			<Input
				placeholder="Search..."
				value={search}
				oninput={(event) => onSearch?.(event.currentTarget.value)}
				class="max-w-sm"
			/>
		{/if}
	</div>
	<div class="flex justify-end gap-2">
		{@render actions?.()}
	</div>
</div>
