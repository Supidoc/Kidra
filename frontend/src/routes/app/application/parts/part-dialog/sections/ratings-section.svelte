<script lang="ts">
	import { Button } from '#lib/components/ui/button/index.js';
	import {
		createColumns,
		DataTable,
		type RowActionContext
	} from '#lib/components/data-table/index.js';
	import { Trash2Icon } from '@lucide/svelte';
	import type { EditableRows } from '../editable-rows.svelte.ts';
	import type { RatingDraft } from '../types.ts';

	type Props = {
		rows: EditableRows<RatingDraft>;
		readOnly: boolean;
	};

	let { rows, readOnly }: Props = $props();

	const columns = $derived(
		createColumns<RatingDraft>([
			{
				header: 'Key',
				accessor: 'key',
				type: 'text',
				editable: !readOnly,
				searchable: true
			},
			{
				header: 'Value',
				accessor: 'value',
				type: 'text',
				editable: !readOnly,
				searchable: true
			}
		])
	);
	function newRating(): RatingDraft {
		return { id: `new-${crypto.randomUUID()}`, key: '', value: '' };
	}

	const errorMessages = $derived([...new Set(Object.values(rows.errors))]);
</script>

{#snippet deleteRatingAction({ row }: RowActionContext<RatingDraft>)}
	<Button
		variant="ghost"
		size="icon"
		aria-label={`Delete rating ${row.key || 'row'}`}
		onclick={() => rows.remove(row.id)}
	>
		<Trash2Icon />
	</Button>
{/snippet}

<section class="flex flex-col gap-3">
	<DataTable
		data={rows.rows}
		{columns}
		showSearch={false}
		variant="embedded"
		onUpdate={(row) => rows.update([row])}
		onCreate={(row) => rows.add([row])}
		createRow={readOnly ? undefined : newRating}
		rowActions={readOnly ? undefined : deleteRatingAction}
	/>
	<div aria-live="polite">
		{#each errorMessages as message (message)}
			<p class="text-sm text-destructive">{message}</p>
		{/each}
	</div>
</section>
