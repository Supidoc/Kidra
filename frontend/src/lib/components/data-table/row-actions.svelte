<script lang="ts" module>
	/** What a custom `rowActions` snippet receives for each row. */
	export type RowActionContext<T> = {
		row: T;
		/** The row is unsaved and was added through "Add row". */
		isNew: boolean;
		isEditing: boolean;
	};
</script>

<script lang="ts" generics="T">
	import type { Snippet } from 'svelte';
	import { CheckIcon, PencilIcon, RotateCcwIcon } from '@lucide/svelte';
	import { Button } from '#lib/components/ui/button/index.js';

	type Props = {
		context: RowActionContext<T>;
		/** Reserves space for the edit buttons; the table has editable columns. */
		showEditControls: boolean;
		/** Shows the pencil button; this row has editable cells. */
		canEdit: boolean;
		/** Disables the confirm button while the row is being written. */
		saving?: boolean;
		onEdit: () => void;
		onConfirm: () => void;
		onRevert: () => void;
		actions?: Snippet<[RowActionContext<T>]>;
	};

	let {
		context,
		showEditControls,
		canEdit,
		saving = false,
		onEdit,
		onConfirm,
		onRevert,
		actions
	}: Props = $props();
</script>

<div class="flex w-max justify-end gap-1">
	{#if showEditControls}
		<div class="flex w-19 shrink-0 justify-end gap-1">
			{#if context.isEditing}
				<Button
					variant="ghost"
					size="icon"
					aria-label="Confirm row edits"
					disabled={saving}
					onclick={onConfirm}
				>
					<CheckIcon />
				</Button>
				<Button variant="ghost" size="icon" aria-label="Revert row edits" onclick={onRevert}>
					<RotateCcwIcon />
				</Button>
			{:else if canEdit}
				<Button variant="ghost" size="icon" aria-label="Edit row" onclick={onEdit}>
					<PencilIcon />
				</Button>
			{/if}
		</div>
	{/if}
	{@render actions?.(context)}
</div>
