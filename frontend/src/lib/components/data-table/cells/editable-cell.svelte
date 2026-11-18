<script lang="ts">
	import { untrack } from 'svelte';
	import { Input } from '#lib/components/ui/input/index.js';
	import {
		Combobox,
		type ComboboxGroup,
		type ComboboxOption
	} from '#lib/components/combobox/index.js';
	import type { ColumnType } from '../columns.ts';
	import { getTableEditContext } from '../context.ts';

	type Props = {
		rowId: string;
		/** Row property the editor writes. */
		field: string;
		type: ColumnType;
		value: unknown;
		/** Shown instead of `value` when not editing, e.g. a combobox option label. */
		label?: string;
		options?: ComboboxOption[];
		groups?: ComboboxGroup[];
		placeholder?: string;
		searchPlaceholder?: string;
	};

	let { rowId, field, type, value, label, options, groups, placeholder, searchPlaceholder }: Props =
		$props();

	const edit = getTableEditContext();
	const editing = $derived(edit.isEditingRow(rowId));
	let draft = $state<string | boolean>('');

	// Start each edit session from the row's current value.
	$effect.pre(() => {
		if (editing) draft = untrack(() => toInputValue(value));
	});

	function write(next: string | boolean) {
		draft = next;
		edit.setCell(rowId, field, fromInputValue(next));
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key !== 'Escape') return;
		event.preventDefault();
		edit.cancel();
	}

	function toInputValue(input: unknown): string | boolean {
		if (type === 'boolean') return Boolean(input);
		if (type === 'dateTime' && input) {
			const date = input instanceof Date ? input : new Date(String(input));
			return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 16);
		}
		return input == null ? '' : String(input);
	}

	function fromInputValue(input: string | boolean): unknown {
		if (type === 'boolean') return input === true;
		if (type === 'number') return input === '' ? null : Number(input);
		if (type === 'dateTime') return input ? new Date(String(input)).toISOString() : null;
		return input;
	}
</script>

<div class="relative min-h-9 w-full min-w-0">
	<span
		class:invisible={editing}
		class:pointer-events-none={editing}
		aria-hidden={editing}
		class="flex min-h-9 w-full items-center truncate text-left"
	>
		{label ?? (value == null ? '' : String(value))}
	</span>
	{#if editing}
		<div data-cell-editor class="absolute inset-0 z-10">
			{#if type === 'boolean'}
				<label class="flex h-full items-center gap-2">
					<input
						type="checkbox"
						checked={draft === true}
						onchange={(event) => write(event.currentTarget.checked)}
						onkeydown={handleKeydown}
					/>
					<span class="sr-only">Edit value</span>
				</label>
			{:else if type === 'combobox'}
				<Combobox
					value={String(draft)}
					{options}
					{groups}
					{placeholder}
					{searchPlaceholder}
					class="h-full min-h-9"
					onkeydown={handleKeydown}
					onChange={write}
				/>
			{:else}
				<Input
					type={type === 'number' ? 'number' : type === 'dateTime' ? 'datetime-local' : 'text'}
					value={String(draft)}
					oninput={(event) => write(event.currentTarget.value)}
					onkeydown={handleKeydown}
					class="h-full min-h-9 w-full rounded-3xl px-3 py-1"
				/>
			{/if}
		</div>
	{/if}
</div>
