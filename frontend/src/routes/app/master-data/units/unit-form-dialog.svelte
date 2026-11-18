<script lang="ts" module>
	export type UnitFormValues = {
		name: string;
		symbolFancy: string;
		symbolLetter: string;
		factor: number;
	};
</script>

<script lang="ts">
	import { Button } from '#lib/components/ui/button/index.js';
	import * as Dialog from '#lib/components/ui/dialog/index.js';
	import * as Field from '#lib/components/ui/field/index.js';
	import { Input } from '#lib/components/ui/input/index.js';
	import type { UnitSetsRecord } from '#lib/data/pocketbase-types.ts';

	type Props = {
		open?: boolean;
		/** The set to add a unit to; without one the dialog adds a unit set (name only). */
		unitSet?: UnitSetsRecord;
		/** Return `false` to keep the dialog open. */
		onSave: (values: UnitFormValues) => Promise<boolean>;
	};

	let { open = $bindable(false), unitSet, onSave }: Props = $props();

	const id = $props.id();
	let saving = $state(false);

	async function submit(event: SubmitEvent & { currentTarget: HTMLFormElement }) {
		event.preventDefault();
		const form = new FormData(event.currentTarget);
		const text = (key: string) => String(form.get(key) ?? '').trim();

		saving = true;
		try {
			const saved = await onSave({
				name: text('name'),
				symbolFancy: text('symbolFancy'),
				symbolLetter: text('symbolLetter'),
				factor: Number(text('factor') || 1)
			});
			if (saved) open = false;
		} finally {
			saving = false;
		}
	}
</script>

<Dialog.Root bind:open>
	<Dialog.Content>
		<form onsubmit={submit} class="grid gap-6">
			<Dialog.Header>
				<Dialog.Title>{unitSet ? `Add unit to ${unitSet.name}` : 'Add unit set'}</Dialog.Title>
			</Dialog.Header>
			<Field.Group>
				<Field.Field>
					<Field.Label for="{id}-name">Name</Field.Label>
					<Input id="{id}-name" name="name" required />
				</Field.Field>
				{#if unitSet}
					<Field.Field>
						<Field.Label for="{id}-symbol-fancy">Fancy symbol</Field.Label>
						<Input id="{id}-symbol-fancy" name="symbolFancy" />
					</Field.Field>
					<Field.Field>
						<Field.Label for="{id}-symbol-letter">Letter symbol</Field.Label>
						<Input id="{id}-symbol-letter" name="symbolLetter" />
					</Field.Field>
					<Field.Field>
						<Field.Label for="{id}-factor">Factor</Field.Label>
						<Input id="{id}-factor" name="factor" type="number" step="any" value={1} required />
					</Field.Field>
				{/if}
			</Field.Group>
			<Dialog.Footer>
				<Dialog.Close>
					{#snippet child({ props })}
						<Button {...props} variant="outline">Cancel</Button>
					{/snippet}
				</Dialog.Close>
				<Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>
