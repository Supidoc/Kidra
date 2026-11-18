<script lang="ts">
	import * as AlertDialog from '#lib/components/ui/alert-dialog/index.js';

	type Props = {
		/** Whether the dialog is shown. */
		open?: boolean;
		/** Name of the item to delete, shown in quotes. */
		itemName: string;
		/** What kind of item this is, e.g. "category". Used for the default title. */
		entityLabel?: string;
		/** Overrides the default title "Delete {entityLabel}?". */
		title?: string;
		/** Extra sentence appended to the description, e.g. "It will also be removed from 3 parts." */
		extraText?: string;
		/** Runs the delete. Return `false` to keep the dialog open (e.g. when it failed). */
		onConfirm: () => Promise<boolean | void> | boolean | void;
	};

	let {
		open = $bindable(false),
		itemName,
		entityLabel = 'item',
		title,
		extraText,
		onConfirm
	}: Props = $props();

	let pending = $state(false);

	async function confirm() {
		pending = true;
		try {
			const result = await onConfirm();
			if (result !== false) open = false;
		} finally {
			pending = false;
		}
	}
</script>

<AlertDialog.Root bind:open>
	<AlertDialog.Content>
		<AlertDialog.Header>
			<AlertDialog.Title>{title ?? `Delete ${entityLabel}?`}</AlertDialog.Title>
			<AlertDialog.Description>
				This action cannot be undone. This will permanently delete "{itemName}".
				{#if extraText}{extraText}{/if}
			</AlertDialog.Description>
		</AlertDialog.Header>
		<AlertDialog.Footer>
			<AlertDialog.Cancel disabled={pending}>Cancel</AlertDialog.Cancel>
			<AlertDialog.Action variant="destructive" disabled={pending} onclick={confirm}>
				{pending ? 'Deleting…' : 'Delete'}
			</AlertDialog.Action>
		</AlertDialog.Footer>
	</AlertDialog.Content>
</AlertDialog.Root>
