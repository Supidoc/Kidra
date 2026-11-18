<script lang="ts">
	import { untrack } from 'svelte';
	import { BoxIcon, CircuitBoardIcon, ShapesIcon } from '@lucide/svelte';
	import type { PreviewEntry } from '#lib/components/preview/index.js';
	import * as Accordion from '#lib/components/ui/accordion/index.js';
	import { FootprintModelState } from '#lib/data/footprint-model.svelte.ts';
	import { footprintPreviewUrl, symbolPreviewUrl } from '#lib/data/kicad-previews.ts';
	import type { PartsRecord } from '#lib/data/pocketbase-types.ts';
	import { AttachmentListState } from './attachments/attachment-list-state.svelte.ts';
	import AttachmentPickerDialog from './attachments/attachment-picker-dialog.svelte';
	import AttachmentsPanel from './attachments/attachments-panel.svelte';
	import { PartFormState } from './part-form.svelte.ts';
	import type { PartLookups } from './part-lookups.svelte.ts';
	import DetailsSection from './sections/details-section.svelte';
	import DistributorsSection from './sections/distributors-section.svelte';
	import GeneralSection from './sections/general-section.svelte';
	import RatingsSection from './sections/ratings-section.svelte';
	import type { Mode, PartDraft } from './types.ts';

	type Props = {
		mode: Mode;
		part: PartsRecord | null;
		lookups: PartLookups;
		onSave: (draft: PartDraft) => void | Promise<void>;
	};

	let { mode, part, lookups, onSave }: Props = $props();

	const form = new PartFormState(() => lookups);
	const attachments = new AttachmentListState(() => lookups.attachments);
	const readOnly = $derived(mode === 'view');

	// Symbol, footprint and footprint 3D model of the form, previewed in the attachments panel.
	const FOOTPRINT_3D_KEY = 'kicad:footprint-3d';
	const symbol = $derived(lookups.symbols.find((item) => item.id === form.symbol));
	const footprint = $derived(lookups.footprints.find((item) => item.id === form.footprint));
	// The model is only downloaded while its entry is selected.
	const footprintModel = new FootprintModelState(
		() => form.footprint,
		() => attachments.selectedKey === FOOTPRINT_3D_KEY
	);

	function qualifiedName(
		item: { name: string; library?: string } | undefined,
		libraries: { id: string; name: string }[]
	) {
		if (!item) return 'None selected';
		const library = libraries.find((entry) => entry.id === item.library)?.name;
		return library ? `${library}: ${item.name}` : item.name;
	}

	const kicadEntries = $derived.by((): PreviewEntry[] => {
		const symbolUrl = symbol ? symbolPreviewUrl(symbol) : '';
		const footprintUrl = footprint ? footprintPreviewUrl(footprint) : '';
		const entries: PreviewEntry[] = [
			{
				key: 'kicad:symbol',
				group: 'KiCad',
				label: 'Symbol',
				detail: qualifiedName(symbol, lookups.symbolLibraries),
				icon: ShapesIcon,
				preview:
					symbol && symbolUrl ? { kind: 'svg', src: symbolUrl, name: `${symbol.name}.svg` } : null,
				emptyText: symbol ? 'No preview available.' : 'No symbol selected.'
			},
			{
				key: 'kicad:footprint',
				group: 'KiCad',
				label: 'Footprint',
				detail: qualifiedName(footprint, lookups.footprintLibraries),
				icon: CircuitBoardIcon,
				preview:
					footprint && footprintUrl
						? { kind: 'svg', src: footprintUrl, name: `${footprint.name}.svg` }
						: null,
				emptyText: footprint ? 'No preview available.' : 'No footprint selected.'
			}
		];
		const info = footprintModel.info;
		if (footprint && info?.exists) {
			entries.push({
				key: FOOTPRINT_3D_KEY,
				group: 'KiCad',
				label: 'Footprint 3D',
				detail: info.filename,
				icon: BoxIcon,
				preview: footprintModel.url
					? { kind: '3d', src: footprintModel.url, name: info.filename ?? 'model.step' }
					: null,
				emptyText: footprintModel.error || 'Loading 3D model…'
			});
		}
		return entries;
	});

	// Reset only when the part or mode changes; lookup reloads must not wipe in-progress edits.
	$effect(() => {
		void part;
		void mode;
		untrack(() => {
			form.reset(part);
			attachments.reset(part);
		});
	});

	async function submit(event: SubmitEvent) {
		event.preventDefault();
		if (readOnly || form.isSaving) return;
		if (!form.validateAll()) return;
		form.isSaving = true;
		try {
			await onSave({
				part: form.toPart(part),
				ratings: form.ratings.rows,
				distributorParts: form.distributorParts.rows,
				attachments: attachments.rows,
				primaryDatasheetId: attachments.primaryDatasheetId,
				tags: form.tags,
				onUploadProgress: attachments.onUploadProgress
			});
		} finally {
			form.isSaving = false;
		}
	}
</script>

<form
	id="part-dialog-form"
	class="grid max-h-[80vh] grid-cols-1 gap-6 overflow-y-auto py-2 pr-2 lg:grid-cols-[minmax(0,1fr)_minmax(22rem,0.8fr)]"
	onsubmit={submit}
	novalidate
>
	<section class="flex flex-col gap-3">
		<Accordion.Root type="single" class="lg:col-start-1 " value="general">
			<Accordion.Item value="general">
				<Accordion.Trigger
					><h2 class="text-base font-semibold">General Information</h2></Accordion.Trigger
				>
				<Accordion.Content>
					<GeneralSection {form} {lookups} {readOnly} />
				</Accordion.Content>
			</Accordion.Item>

			<Accordion.Item value="details">
				<Accordion.Trigger><h2 class="text-base font-semibold">Details</h2></Accordion.Trigger>
				<Accordion.Content>
					<DetailsSection {form} {readOnly} />
				</Accordion.Content>
			</Accordion.Item>

			<Accordion.Item value="ratings">
				<Accordion.Trigger><h2 class="text-base font-semibold">Ratings</h2></Accordion.Trigger>
				<Accordion.Content>
					<RatingsSection rows={form.ratings} {readOnly} />
				</Accordion.Content>
			</Accordion.Item>

			<Accordion.Item value="distributor-parts">
				<Accordion.Trigger>
					<div>
						<h2 class="text-base font-semibold">Distributors</h2>
					</div>
				</Accordion.Trigger>
				<Accordion.Content>
					<DistributorsSection
						rows={form.distributorParts}
						options={form.options.distributorOptions}
						{readOnly}
					/>
				</Accordion.Content>
			</Accordion.Item>
		</Accordion.Root>
	</section>

	<AttachmentsPanel {attachments} {readOnly} extraItems={kicadEntries} />
</form>

<AttachmentPickerDialog {attachments} />
