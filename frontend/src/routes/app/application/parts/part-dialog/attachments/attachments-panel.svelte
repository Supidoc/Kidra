<script lang="ts" module>
	import type { Component } from 'svelte';
	import {
		BookOpenIcon,
		BoxIcon,
		FileTextIcon,
		ImageIcon,
		NotebookTextIcon,
		PaperclipIcon
	} from '@lucide/svelte';
	import type { AttachmentKind } from '#lib/data/attachments.ts';

	type Icon = Component<{ class?: string }>;

	export const kindIcons: Record<AttachmentKind, Icon> = {
		datasheet: FileTextIcon,
		'reference-manual': BookOpenIcon,
		'app-note': NotebookTextIcon,
		'3d-model': BoxIcon,
		image: ImageIcon,
		other: PaperclipIcon
	};
</script>

<script lang="ts">
	import { LinkIcon, StarIcon, UploadIcon, XIcon } from '@lucide/svelte';
	import { AttachmentPreview, type PreviewEntry } from '#lib/components/preview/index.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import * as Field from '#lib/components/ui/field/index.js';
	import { Input } from '#lib/components/ui/input/index.js';
	import { Progress } from '#lib/components/ui/progress/index.js';
	import * as Select from '#lib/components/ui/select/index.js';
	import { attachmentKindLabel, attachmentKinds } from '#lib/data/attachments.ts';
	import type { AttachmentListState, AttachmentRow } from './attachment-list-state.svelte.ts';

	type Props = {
		attachments: AttachmentListState;
		readOnly: boolean;
		/**
		 * Non-attachment entries listed after the attachments and previewed in the same pane
		 * (e.g. the part's symbol and footprint). They are selected like attachment rows.
		 */
		extraItems?: PreviewEntry[];
	};

	let { attachments, readOnly, extraItems = [] }: Props = $props();

	const groups = $derived(
		attachmentKinds
			.map((kind) => ({
				...kind,
				rows: attachments.rows.filter((row) => row.kind === kind.value)
			}))
			.filter((group) => group.rows.length > 0)
	);

	const extraGroups = $derived(
		[...new Set(extraItems.map((item) => item.group))].map((group) => ({
			group,
			items: extraItems.filter((item) => item.group === group)
		}))
	);

	const selectedExtra = $derived(extraItems.find((item) => item.key === attachments.selectedKey));
	const preview = $derived(
		selectedExtra ? selectedExtra.preview : attachments.previewFor(attachments.selected)
	);
	const emptyText = $derived(
		selectedExtra
			? (selectedExtra.emptyText ?? 'No preview available.')
			: attachments.selected
				? 'This attachment has no file or link.'
				: 'Select an attachment to preview it.'
	);
	const selected = $derived(selectedExtra ? null : attachments.selected);
</script>

{#snippet entryButton(key: string, label: string, detail: string, Icon: Icon)}
	<button
		type="button"
		class="flex min-w-0 flex-1 items-center gap-2 text-left"
		aria-pressed={attachments.selectedKey === key}
		onclick={() => attachments.select(key)}
	>
		<Icon class="size-4 shrink-0 text-muted-foreground" />
		<span class="min-w-0 flex-1">
			<span class="block truncate text-sm">{label}</span>
			{#if detail}<span class="block truncate text-xs text-muted-foreground">{detail}</span>{/if}
		</span>
	</button>
{/snippet}

{#snippet attachmentRow(row: AttachmentRow)}
	{@const record = attachments.recordFor(row)}
	{@const progress = attachments.progress.get(row.key)}
	{@const isPrimary = attachments.primaryKey === row.key}
	<li
		class={[
			'flex flex-col gap-1 rounded-md px-2 py-1.5',
			attachments.selectedKey === row.key ? 'bg-muted' : 'hover:bg-muted/50'
		]}
	>
		<div class="flex items-center gap-2">
			{@render entryButton(
				row.key,
				row.name || row.file?.name || record?.file || row.url || 'Untitled',
				row.file && !record
					? `New file · ${row.file.name}`
					: !record?.file && row.url
						? row.url
						: '',
				kindIcons[row.kind]
			)}
			<Select.Root
				type="single"
				value={row.kind}
				disabled={readOnly}
				onValueChange={(value) => attachments.setKind(row.key, value as AttachmentKind)}
			>
				<Select.Trigger size="sm" class="w-36 shrink-0" aria-label="Attachment kind">
					{attachmentKindLabel(row.kind)}
				</Select.Trigger>
				<Select.Content>
					{#each attachmentKinds as kind (kind.value)}
						<Select.Item value={kind.value} label={kind.label}>{kind.label}</Select.Item>
					{/each}
				</Select.Content>
			</Select.Root>
			{#if row.kind === 'datasheet'}
				<Button
					type="button"
					variant="ghost"
					size="icon-sm"
					disabled={readOnly}
					aria-pressed={isPrimary}
					aria-label={isPrimary ? 'Primary datasheet' : 'Make primary datasheet'}
					title={isPrimary ? 'Primary datasheet (used by KiCad)' : 'Make primary datasheet'}
					onclick={() => attachments.setPrimary(row.key)}
				>
					<StarIcon class={isPrimary ? 'fill-amber-400 text-amber-500' : ''} />
				</Button>
			{:else}
				<span class="size-8 shrink-0"></span>
			{/if}
			{#if !readOnly}
				<Button
					type="button"
					variant="ghost"
					size="icon-sm"
					aria-label="Remove from part"
					title="Remove from part (the attachment stays in the library)"
					onclick={() => attachments.remove(row.key)}
				>
					<XIcon />
				</Button>
			{/if}
		</div>
		{#if progress !== undefined}
			<Progress value={Math.round(progress * 100)} class="h-1.5" aria-label="Upload progress" />
		{/if}
	</li>
{/snippet}

<section
	class="order-last flex flex-col gap-3 lg:order-none lg:col-start-2 lg:row-span-6 lg:row-start-1"
>
	<h2 class="text-base font-semibold">Attachments</h2>

	{#if !readOnly}
		<div class="grid gap-3 sm:grid-cols-2">
			<label
				for="attachment-files"
				class="flex min-h-24 cursor-pointer flex-col items-center justify-center gap-1 rounded-md border border-dashed p-3 text-center text-sm text-muted-foreground hover:bg-muted/50"
				ondragover={(event) => event.preventDefault()}
				ondrop={(event) => {
					event.preventDefault();
					attachments.addFiles(event.dataTransfer?.files ? [...event.dataTransfer.files] : null);
				}}
			>
				<UploadIcon class="size-5" />
				<span class="font-medium text-foreground">Drop files here</span>
				<span>or click to choose (PDF, images, 3D models, …)</span>
				<Input
					id="attachment-files"
					class="sr-only"
					type="file"
					multiple
					onchange={attachments.handleFileInput}
				/>
			</label>
			<div class="flex flex-col gap-2">
				<Field.Field>
					<Field.FieldLabel for="attachment-url" class="sr-only">File URL</Field.FieldLabel>
					<Input
						id="attachment-url"
						bind:value={attachments.downloadUrl}
						placeholder="https://..."
					/>
				</Field.Field>
				<div class="flex gap-2">
					<Button
						type="button"
						variant="outline"
						class="flex-1"
						disabled={attachments.isDownloading || !attachments.downloadUrl.trim()}
						onclick={attachments.downloadFromUrl}
						>{attachments.isDownloading ? 'Downloading…' : 'Download'}</Button
					>
					<Button
						type="button"
						variant="outline"
						disabled={!attachments.downloadUrl.trim()}
						title="Link the URL without storing the file"
						onclick={attachments.addLink}><LinkIcon />Link</Button
					>
				</div>
				<Button type="button" variant="outline" onclick={attachments.openPicker}
					>Select existing…</Button
				>
			</div>
		</div>
	{/if}
	{#if attachments.error}<p class="text-sm text-destructive">{attachments.error}</p>{/if}

	<div class="flex flex-col gap-2">
		{#each groups as group (group.value)}
			<div>
				<h3 class="px-2 text-xs font-medium text-muted-foreground uppercase">{group.label}</h3>
				<ul>
					{#each group.rows as row (row.key)}
						{@render attachmentRow(row)}
					{/each}
				</ul>
			</div>
		{:else}
			<p class="px-2 text-sm text-muted-foreground">No attachments.</p>
		{/each}
		{#each extraGroups as { group, items } (group)}
			<div>
				<h3 class="px-2 text-xs font-medium text-muted-foreground uppercase">{group}</h3>
				<ul>
					{#each items as item (item.key)}
						<li
							class={[
								'flex items-center rounded-md px-2 py-1.5',
								attachments.selectedKey === item.key ? 'bg-muted' : 'hover:bg-muted/50'
							]}
						>
							{@render entryButton(
								item.key,
								item.label,
								item.detail ?? '',
								item.icon ?? PaperclipIcon
							)}
						</li>
					{/each}
				</ul>
			</div>
		{/each}
	</div>

	{#if selected}
		<div class="grid gap-3 sm:grid-cols-2">
			<Field.Field>
				<Field.FieldLabel for="attachment-name">Name</Field.FieldLabel>
				<Input
					id="attachment-name"
					value={selected.name}
					readonly={readOnly}
					aria-readonly={readOnly}
					oninput={(event) => attachments.update(selected.key, 'name', event.currentTarget.value)}
				/>
			</Field.Field>
			<Field.Field>
				<Field.FieldLabel for="attachment-source-url">Source URL</Field.FieldLabel>
				<Input
					id="attachment-source-url"
					value={selected.url}
					readonly={readOnly}
					aria-readonly={readOnly}
					placeholder="Where the file came from"
					oninput={(event) => attachments.update(selected.key, 'url', event.currentTarget.value)}
				/>
			</Field.Field>
			<Field.Field class="sm:col-span-2">
				<Field.FieldLabel for="attachment-description">Description</Field.FieldLabel>
				<Input
					id="attachment-description"
					value={selected.description}
					readonly={readOnly}
					aria-readonly={readOnly}
					oninput={(event) =>
						attachments.update(selected.key, 'description', event.currentTarget.value)}
				/>
			</Field.Field>
		</div>
	{/if}

	<!-- The one preview area of the dialog: attachments and extra entries all show here. -->
	<div class="min-h-64 overflow-hidden rounded-md border bg-muted/20">
		<AttachmentPreview {preview} height="32rem" {emptyText} />
	</div>
</section>
