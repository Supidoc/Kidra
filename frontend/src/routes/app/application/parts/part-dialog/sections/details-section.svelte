<script lang="ts">
	import * as Field from '#lib/components/ui/field/index.js';
	import { Input } from '#lib/components/ui/input/index.js';
	import * as Select from '#lib/components/ui/select/index.js';
	import { Switch } from '#lib/components/ui/switch/index.ts';
	import { TagInput } from '#lib/components/tag-input/index.js';
	import type { PartFormState } from '../part-form.svelte.ts';

	type Props = {
		form: PartFormState;
		readOnly: boolean;
	};

	let { form, readOnly }: Props = $props();
</script>

<section class="flex flex-col gap-4">
	<Field.Field
		><Field.FieldLabel for="part-description">Description</Field.FieldLabel><Input
			id="part-description"
			bind:value={form.description}
			readonly={readOnly}
			aria-readonly={readOnly}
		/></Field.Field
	>
	<Field.Field>
		<Field.FieldLabel for="part-tags">Tags</Field.FieldLabel>
		<TagInput
			id="part-tags"
			bind:value={form.tags}
			suggestions={form.options.tagSuggestions}
			readonly={readOnly}
			placeholder="Type to search or press Enter to add..."
		/>
	</Field.Field>
	<div class="grid gap-4 sm:grid-cols-2">
		<Field.Field>
			<Field.FieldLabel for="part-status">Status</Field.FieldLabel>
			{#if readOnly}
				<Input id="part-status" value={form.status} readonly aria-readonly="true" />
			{:else}
				<Select.Root type="single" items={form.options.statusOptions} bind:value={form.status}
					><Select.Trigger id="part-status" class="w-full"
						><Select.Value placeholder="Select status" /></Select.Trigger
					><Select.Content
						><Select.Group
							><Select.Label>Status</Select.Label
							>{#each form.options.statusOptions as option (option.value)}<Select.Item
									value={option.value}
									label={option.label}>{option.label}</Select.Item
								>{/each}</Select.Group
						></Select.Content
					>
				</Select.Root>
			{/if}
		</Field.Field>
		<Field.Field
			><Field.FieldLabel for="part-version">Version</Field.FieldLabel><Input
				id="part-version"
				type="number"
				value={form.version}
				readonly
				aria-readonly="true"
			/></Field.Field
		>
	</div>
	<div class="grid gap-4 sm:grid-cols-2">
		<Field.Field orientation="horizontal">
			<Switch id="exclude-board" bind:checked={form.excludeFromBoard} disabled={readOnly} />
			<Field.FieldLabel for="exclude-board">Exclude from board</Field.FieldLabel></Field.Field
		>
		<Field.Field orientation="horizontal">
			<Switch id="exclude-bom" bind:checked={form.excludeFromBom} disabled={readOnly} />
			<Field.FieldLabel for="exclude-bom">Exclude from BOM</Field.FieldLabel></Field.Field
		>
	</div>
</section>
