<script lang="ts">
	import { AttachmentPreview } from '#lib/components/preview/index.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import { Checkbox } from '#lib/components/ui/checkbox/index.js';
	import * as Dialog from '#lib/components/ui/dialog/index.js';
	import { Input } from '#lib/components/ui/input/index.js';
	import * as Select from '#lib/components/ui/select/index.js';
	import * as Table from '#lib/components/ui/table/index.js';
	import {
		attachmentKindLabel,
		attachmentKinds,
		type AttachmentKind
	} from '#lib/data/attachments.ts';
	import type { AttachmentListState } from './attachment-list-state.svelte.ts';

	let { attachments }: { attachments: AttachmentListState } = $props();
</script>

<Dialog.Root bind:open={attachments.pickerOpen}>
	<Dialog.Content
		class="max-h-[calc(100vh-1rem)] min-h-[min(88vh,58rem)] max-w-[70rem] sm:max-w-[70rem]"
	>
		<Dialog.Header>
			<Dialog.Title>Select existing attachments</Dialog.Title>
		</Dialog.Header>
		<div class="grid min-h-0 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(20rem,1fr)]">
			<div class="flex min-h-0 flex-col gap-3">
				<div class="flex gap-2">
					<Input
						bind:value={attachments.search}
						placeholder="Search by name, URL or description..."
						class="flex-1"
					/>
					<Select.Root
						type="single"
						value={attachments.kindFilter}
						onValueChange={(value) => {
							attachments.kindFilter = value as AttachmentKind | 'all';
						}}
					>
						<Select.Trigger class="w-44" aria-label="Filter by kind">
							{attachments.kindFilter === 'all'
								? 'All kinds'
								: attachmentKindLabel(attachments.kindFilter)}
						</Select.Trigger>
						<Select.Content>
							<Select.Item value="all" label="All kinds">All kinds</Select.Item>
							{#each attachmentKinds as kind (kind.value)}
								<Select.Item value={kind.value} label={kind.label}>{kind.label}</Select.Item>
							{/each}
						</Select.Content>
					</Select.Root>
				</div>
				<div class="max-h-[28rem] overflow-y-auto rounded-md border">
					<Table.Root class="table-fixed">
						<Table.Header>
							<Table.Row>
								<Table.Head class="w-10"></Table.Head>
								<Table.Head>Name</Table.Head>
								<Table.Head class="w-32">Kind</Table.Head>
								<Table.Head>File / URL</Table.Head>
							</Table.Row>
						</Table.Header>
						<Table.Body>
							{#each attachments.filtered as record (record.id)}
								{@const checked = attachments.picked.has(record.id)}
								{@const name = record.name || record.file || record.id}
								{@const source = record.file || record.url || '—'}
								<Table.Row
									class={['cursor-pointer', attachments.candidate?.id === record.id && 'bg-muted']}
									tabindex={0}
									onclick={() => attachments.previewRecord(record)}
									onkeydown={(event) => {
										if (event.target !== event.currentTarget) return;
										if (event.key === 'Enter') {
											event.preventDefault();
											attachments.previewRecord(record);
										} else if (event.key === ' ') {
											event.preventDefault();
											attachments.toggle(record);
										}
									}}
								>
									<Table.Cell onclick={(event) => event.stopPropagation()}>
										<Checkbox
											{checked}
											onCheckedChange={() => attachments.toggle(record)}
											aria-label="Select {name}"
										/>
									</Table.Cell>
									<Table.Cell class="truncate" title={name}>{name}</Table.Cell>
									<Table.Cell class="truncate">{attachmentKindLabel(record.kind)}</Table.Cell>
									<Table.Cell class="truncate" title={source}>{source}</Table.Cell>
								</Table.Row>
							{:else}
								<Table.Row>
									<Table.Cell colspan={4} class="text-center text-muted-foreground"
										>No attachments found.</Table.Cell
									>
								</Table.Row>
							{/each}
						</Table.Body>
					</Table.Root>
				</div>
			</div>
			<div class="min-h-62 overflow-hidden rounded-md border bg-muted/20">
				<AttachmentPreview
					preview={attachments.previewForRecord(attachments.candidate)}
					height="60rem"
					emptyText="Select a row to preview it."
				/>
			</div>
		</div>
		<Dialog.Footer>
			<Button type="button" variant="outline" onclick={attachments.closePicker}>Cancel</Button>
			<Button type="button" disabled={attachments.picked.size === 0} onclick={attachments.confirm}
				>Link {attachments.picked.size || ''} selected</Button
			>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
