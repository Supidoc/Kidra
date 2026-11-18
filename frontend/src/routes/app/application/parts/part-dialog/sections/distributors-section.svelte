<script lang="ts">
	import { Button } from '#lib/components/ui/button/index.js';
	import type { ComboboxOption } from '#lib/components/combobox/index.js';
	import {
		createColumns,
		DataTable,
		type RowActionContext
	} from '#lib/components/data-table/index.js';
	import { Trash2Icon } from '@lucide/svelte';
	import type { EditableRows } from '../editable-rows.svelte.ts';
	import { display } from '../part-lookups.svelte.ts';
	import type { DistributorPartsDraft } from '../types.ts';

	type Props = {
		rows: EditableRows<DistributorPartsDraft>;
		options: ComboboxOption[];
		readOnly: boolean;
	};

	let { rows, options, readOnly }: Props = $props();

	const columns = $derived(
		createColumns<DistributorPartsDraft>([
			{
				header: 'Distributor',
				accessor: 'distributor',
				labelAccessor: 'expand.distributor.name',
				type: 'combobox',
				options,
				placeholder: 'Select distributor',
				searchPlaceholder: 'Search distributors...',
				editable: !readOnly,
				searchable: true
			},
			{
				header: 'Distributor number',
				accessor: 'distributorNumber',
				type: 'text',
				editable: !readOnly,
				searchable: true
			}
		])
	);
	function newDistributorPart(): DistributorPartsDraft {
		return { id: `new-${crypto.randomUUID()}`, distributor: '', distributorNumber: '' };
	}

	const errorMessages = $derived([...new Set(Object.values(rows.errors))]);
</script>

{#snippet deleteDistributorPartAction({ row }: RowActionContext<DistributorPartsDraft>)}
	<Button
		variant="ghost"
		size="icon"
		aria-label={`Delete distributor part ${display(options, row.distributor) || 'row'}`}
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
		createRow={readOnly ? undefined : newDistributorPart}
		rowActions={readOnly ? undefined : deleteDistributorPartAction}
	/>
	<div aria-live="polite">
		{#each errorMessages as message (message)}
			<p class="text-sm text-destructive">{message}</p>
		{/each}
	</div>
</section>
