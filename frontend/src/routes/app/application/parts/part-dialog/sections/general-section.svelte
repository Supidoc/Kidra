<script lang="ts">
	import { Button } from '#lib/components/ui/button/index.js';
	import { Combobox } from '#lib/components/combobox/index.js';
	import * as Field from '#lib/components/ui/field/index.js';
	import { Input } from '#lib/components/ui/input/index.js';
	import * as ButtonGroup from '#lib/components/ui/button-group/index.js';
	import LookupField from '../lookup-field.svelte';
	import type { PartFormState } from '../part-form.svelte.ts';
	import { display, displayWithLibrary, type PartLookups } from '../part-lookups.svelte.ts';

	type Props = {
		form: PartFormState;
		lookups: PartLookups;
		readOnly: boolean;
	};

	let { form, lookups, readOnly }: Props = $props();

	const valueField = $derived(form.valueMode === 'text' ? 'valueRaw' : 'numericValue');
</script>

<section class="flex flex-col gap-3">
	<div class="grid gap-4">
		<LookupField
			id="part-category"
			label="Category"
			required
			value={form.category}
			displayValue={display(form.options.categoryOptions, form.category)}
			{readOnly}
			options={form.options.categoryOptions}
			placeholder="Select category"
			searchPlaceholder="Search categories..."
			invalid={form.isInvalid('category')}
			error={form.errors.category}
			onChange={(value) => {
				form.category = value;
				form.touch('category');
			}}
		/>
		<LookupField
			id="part-designator"
			label="Designator"
			required
			value={form.designator}
			displayValue={display(form.options.designatorOptions, form.designator)}
			{readOnly}
			options={form.options.designatorOptions}
			placeholder="Select designator"
			searchPlaceholder="Search designators..."
			invalid={form.isInvalid('designator')}
			error={form.errors.designator}
			onChange={(value) => {
				form.designator = value;
				form.touch('designator');
			}}
		/>
	</div>
	<div class="grid gap-4 sm:grid-cols-2">
		<LookupField
			id="part-symbol"
			label="Symbol"
			required
			value={form.symbol}
			displayValue={displayWithLibrary(lookups.symbols, form.symbol, lookups.symbolLibraries)}
			{readOnly}
			groups={form.options.symbolsByLibrary}
			placeholder="Select symbol"
			searchPlaceholder="Search symbols..."
			invalid={form.isInvalid('symbol')}
			error={form.errors.symbol}
			onChange={(value) => {
				form.symbol = value;
				form.touch('symbol');
			}}
		/>
		<LookupField
			id="part-footprint"
			label="Footprint"
			required
			value={form.footprint}
			displayValue={displayWithLibrary(
				lookups.footprints,
				form.footprint,
				lookups.footprintLibraries
			)}
			{readOnly}
			groups={form.options.footprintsByLibrary}
			placeholder="Select footprint"
			searchPlaceholder="Search footprints..."
			invalid={form.isInvalid('footprint')}
			error={form.errors.footprint}
			onChange={(value) => {
				form.footprint = value;
				form.touch('footprint');
			}}
		/>
	</div>
	<Field.Field data-invalid={form.isInvalid(valueField)}>
		<Field.FieldLabel for="part-value"
			>Value
			<span class="text-destructive" aria-hidden="true">*</span></Field.FieldLabel
		>
		<div class="flex flex-row gap-4">
			{#if form.valueMode === 'text'}
				<Input
					class="min-w-0 flex-1"
					id="part-value"
					value={form.valueRaw}
					readonly={readOnly}
					aria-readonly={readOnly}
					placeholder="e.g. 10k"
					oninput={(event) => (form.valueRaw = event.currentTarget.value)}
					onblur={() => form.touch('valueRaw')}
				/>
			{:else}
				<div class="grid min-w-0 flex-1 gap-2 sm:grid-cols-2">
					<Input
						id="part-value"
						type="number"
						step="any"
						value={form.numericValue}
						readonly={readOnly}
						aria-readonly={readOnly}
						oninput={(event) => (form.numericValue = event.currentTarget.value)}
						onblur={() => form.touch('numericValue')}
					/>
					{#if readOnly}
						<Input
							aria-label="Unit"
							value={display(form.options.unitOptions, form.unit)}
							readonly
							aria-readonly="true"
						/>
					{:else}
						<Combobox
							id="part-unit"
							invalid={form.isInvalid('unit')}
							value={form.unit}
							groups={form.options.unitsBySet}
							placeholder="Select unit"
							searchPlaceholder="Search units..."
							onChange={(value) => {
								form.unit = value;
								form.touch('unit');
							}}
						/>
					{/if}
				</div>
			{/if}

			{#if !readOnly}
				<div class="flex shrink-0 gap-2">
					<ButtonGroup.Root>
						<Button
							type="button"
							variant={form.valueMode === 'text' ? 'default' : 'outline'}
							onclick={() => (form.valueMode = 'text')}>Text</Button
						>
						<Button
							type="button"
							variant={form.valueMode === 'numeric' ? 'default' : 'outline'}
							onclick={() => (form.valueMode = 'numeric')}>Numeric + unit</Button
						>
					</ButtonGroup.Root>
				</div>
			{/if}
		</div>
		{#if form.isInvalid(valueField)}<Field.FieldDescription class="text-destructive"
				>{form.errors[valueField]}</Field.FieldDescription
			>{/if}
		{#if form.valueMode === 'numeric' && form.isInvalid('unit')}<Field.FieldDescription
				class="text-destructive">{form.errors.unit}</Field.FieldDescription
			>{/if}
	</Field.Field>

	<LookupField
		id="part-manufacturer"
		label="Manufacturer"
		value={form.manufacturer}
		displayValue={display(form.options.manufacturerOptions, form.manufacturer)}
		{readOnly}
		options={form.options.manufacturerOptions}
		placeholder="Select manufacturer"
		searchPlaceholder="Search manufacturers..."
		onChange={(value) => (form.manufacturer = value)}
	/>
	<Field.Field
		><Field.FieldLabel for="part-manufacturer-number">Manufacturer number</Field.FieldLabel><Input
			id="part-manufacturer-number"
			value={form.manufacturerNumber}
			readonly={readOnly}
			aria-readonly={readOnly}
			oninput={(event) => (form.manufacturerNumber = event.currentTarget.value)}
		/></Field.Field
	>
</section>
