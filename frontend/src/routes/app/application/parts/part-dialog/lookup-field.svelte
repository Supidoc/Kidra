<script lang="ts">
	import {
		Combobox,
		type ComboboxGroup,
		type ComboboxOption
	} from '#lib/components/combobox/index.js';
	import * as Field from '#lib/components/ui/field/index.js';
	import { Input } from '#lib/components/ui/input/index.js';

	type Props = {
		id: string;
		label: string;
		required?: boolean;
		value: string;
		/** Text shown in read-only mode. */
		displayValue: string;
		readOnly: boolean;
		options?: ComboboxOption[];
		groups?: ComboboxGroup[];
		placeholder: string;
		searchPlaceholder: string;
		invalid?: boolean;
		error?: string;
		onChange: (value: string) => void;
	};

	let {
		id,
		label,
		required = false,
		value,
		displayValue,
		readOnly,
		options,
		groups,
		placeholder,
		searchPlaceholder,
		invalid = false,
		error,
		onChange
	}: Props = $props();
</script>

<Field.Field data-invalid={invalid}>
	<Field.FieldLabel for={id}
		>{label}{#if required}
			<span class="text-destructive" aria-hidden="true">*</span>{/if}</Field.FieldLabel
	>
	{#if readOnly}
		<Input {id} value={displayValue} readonly aria-readonly="true" />
	{:else}
		<Combobox
			{id}
			{invalid}
			{value}
			{options}
			{groups}
			{placeholder}
			{searchPlaceholder}
			{onChange}
		/>
	{/if}
	{#if invalid}<Field.FieldDescription class="text-destructive">{error}</Field.FieldDescription
		>{/if}
</Field.Field>
