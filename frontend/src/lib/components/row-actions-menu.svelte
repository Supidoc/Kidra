<script lang="ts">
	import type { Snippet } from 'svelte';
	import EllipsisIcon from '@lucide/svelte/icons/ellipsis';
	import * as DropdownMenu from '#lib/components/ui/dropdown-menu/index.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import { notify } from '#lib/notify.ts';

	type Props = {
		/** Record id, copied by the "Copy ID" item. */
		id: string;
		/** Name of the row, used in the screen-reader label "Open actions for {label}". */
		label: string;
		/** What kind of record this is, e.g. "category". Used in the item texts. */
		entityLabel?: string;
		/** Shows a "Delete {entityLabel}" item when set. */
		onDelete?: () => void;
		/** Extra `DropdownMenu.Item`s, rendered between "Copy ID" and "Delete". */
		children?: Snippet;
	};

	let { id, label, entityLabel = 'item', onDelete, children }: Props = $props();

	async function copyId() {
		try {
			await navigator.clipboard.writeText(id);
			notify.success('ID copied');
		} catch {
			notify.error('Could not copy the ID to the clipboard.');
		}
	}
</script>

<DropdownMenu.Root>
	<DropdownMenu.Trigger>
		{#snippet child({ props })}
			<Button {...props} variant="ghost" size="icon" class="relative size-8 p-0">
				<span class="sr-only">Open actions for {label || entityLabel}</span>
				<EllipsisIcon />
			</Button>
		{/snippet}
	</DropdownMenu.Trigger>
	<DropdownMenu.Content>
		<DropdownMenu.Group>
			<DropdownMenu.Label>Actions</DropdownMenu.Label>
			<DropdownMenu.Item onSelect={copyId}>Copy {entityLabel} ID</DropdownMenu.Item>
			{@render children?.()}
			{#if onDelete}
				<DropdownMenu.Item variant="destructive" onSelect={onDelete}>
					Delete {entityLabel}
				</DropdownMenu.Item>
			{/if}
		</DropdownMenu.Group>
	</DropdownMenu.Content>
</DropdownMenu.Root>
