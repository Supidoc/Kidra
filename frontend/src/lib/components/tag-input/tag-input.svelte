<script lang="ts" module>
	/** A tag chip. Tags not yet persisted use an id starting with `new-`. */
	export type TagDraft = { id: string; name: string };
</script>

<script lang="ts">
	import XCircleIcon from '@lucide/svelte/icons/circle-x';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import { Popover as PopoverPrimitive } from 'bits-ui';
	import { Badge } from '#lib/components/ui/badge/index.js';
	import { cn } from '#lib/utils.js';

	type Props = {
		value?: TagDraft[];
		/** All existing tags offered as suggestions. */
		suggestions?: TagDraft[];
		placeholder?: string;
		readonly?: boolean;
		disabled?: boolean;
		id?: string;
		class?: string;
		onChange?: (value: TagDraft[]) => void;
	};

	let {
		value = $bindable([]),
		suggestions = [],
		placeholder = 'Add tags...',
		readonly = false,
		disabled = false,
		id,
		class: className,
		onChange
	}: Props = $props();

	let query = $state('');
	let open = $state(false);
	let activeIndex = $state(-1);
	let wrapperRef = $state<HTMLDivElement>(null!);
	let inputRef = $state<HTMLInputElement>(null!);
	const listId = `tag-input-list-${crypto.randomUUID()}`;

	const normalize = (name: string) => name.trim().toLowerCase();
	const selectedNames = $derived(new Set(value.map((tag) => normalize(tag.name))));
	const trimmedQuery = $derived(query.trim());
	const filtered = $derived(
		suggestions
			.filter((tag) => !selectedNames.has(normalize(tag.name)))
			.filter((tag) => !trimmedQuery || normalize(tag.name).includes(normalize(trimmedQuery)))
			.sort((a, b) => a.name.localeCompare(b.name))
	);
	const exactMatch = $derived(
		suggestions.some((tag) => normalize(tag.name) === normalize(trimmedQuery))
	);
	const canCreate = $derived(
		Boolean(trimmedQuery) && !exactMatch && !selectedNames.has(normalize(trimmedQuery))
	);
	/** Rows shown in the list: suggestions, then an optional "create" row. */
	const rowCount = $derived(filtered.length + (canCreate ? 1 : 0));

	$effect(() => {
		// Reset highlight whenever the visible rows change.
		void rowCount;
		void trimmedQuery;
		activeIndex = trimmedQuery && rowCount > 0 ? 0 : -1;
	});

	function setValue(next: TagDraft[]) {
		value = next;
		onChange?.(next);
	}

	function addTag(tag: TagDraft) {
		if (selectedNames.has(normalize(tag.name))) return;
		setValue([...value, tag]);
		query = '';
		inputRef?.focus();
	}

	function addFromText(text: string) {
		const name = text.trim();
		if (!name) return;
		const existing = suggestions.find((tag) => normalize(tag.name) === normalize(name));
		addTag(existing ?? { id: `new-${crypto.randomUUID()}`, name });
	}

	function removeTag(index: number) {
		setValue(value.filter((_, i) => i !== index));
		inputRef?.focus();
	}

	function commit() {
		if (open && activeIndex >= 0 && activeIndex < filtered.length) {
			addTag(filtered[activeIndex]);
		} else {
			addFromText(query);
		}
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Enter' || event.key === ',') {
			event.preventDefault();
			commit();
		} else if (event.key === 'Backspace' && !query && value.length) {
			removeTag(value.length - 1);
		} else if (event.key === 'ArrowDown') {
			event.preventDefault();
			if (!open) open = true;
			else if (rowCount) activeIndex = (activeIndex + 1) % rowCount;
		} else if (event.key === 'ArrowUp') {
			event.preventDefault();
			if (rowCount) activeIndex = (activeIndex - 1 + rowCount) % rowCount;
		} else if (event.key === 'Escape' && open) {
			event.preventDefault();
			event.stopPropagation();
			open = false;
		}
	}
</script>

<PopoverPrimitive.Root bind:open>
	<div
		bind:this={wrapperRef}
		class={cn(
			'flex min-h-9 w-full min-w-0 flex-wrap items-center gap-1 rounded-3xl border border-input bg-transparent px-2.5 py-1 text-base shadow-xs transition-[color,box-shadow] focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50 md:text-sm dark:bg-input/30',
			(disabled || readonly) && 'focus-within:ring-0',
			disabled && 'pointer-events-none cursor-not-allowed opacity-50',
			className
		)}
		role="presentation"
		onclick={() => inputRef?.focus()}
	>
		{#each value as tag, index (tag.id + tag.name)}
			<Badge variant="secondary" class="h-6 gap-1 text-sm">
				{tag.name}
				{#if !readonly && !disabled}
					<button
						type="button"
						class="rounded-full text-muted-foreground hover:text-foreground"
						aria-label={`Remove tag ${tag.name}`}
						onclick={(event) => {
							event.stopPropagation();
							removeTag(index);
						}}
					>
						<XCircleIcon class="size-3.5" />
					</button>
				{/if}
			</Badge>
		{/each}
		{#if readonly}
			{#if !value.length}<span class="text-muted-foreground">No tags</span>{/if}
		{:else}
			<input
				{id}
				bind:this={inputRef}
				bind:value={query}
				{disabled}
				class="h-7 min-w-24 flex-1 border-0 bg-transparent p-0 outline-none placeholder:text-muted-foreground focus:ring-0"
				placeholder={value.length ? '' : placeholder}
				autocomplete="off"
				role="combobox"
				aria-expanded={open}
				aria-controls={listId}
				aria-autocomplete="list"
				onfocus={() => (open = true)}
				oninput={() => (open = true)}
				onblur={() => (open = false)}
				onkeydown={handleKeydown}
			/>
		{/if}
	</div>
	{#if !readonly && !disabled && rowCount > 0}
		<PopoverPrimitive.Portal>
			<PopoverPrimitive.Content
				customAnchor={wrapperRef}
				side="bottom"
				align="start"
				sideOffset={4}
				trapFocus={false}
				onOpenAutoFocus={(event) => event.preventDefault()}
				onCloseAutoFocus={(event) => event.preventDefault()}
				onInteractOutside={(event) => {
					if (wrapperRef?.contains(event.target as Node)) event.preventDefault();
				}}
				class="z-50 max-h-64 w-(--bits-popover-anchor-width) overflow-y-auto rounded-2xl bg-popover p-1 text-sm text-popover-foreground shadow-lg ring-1 ring-foreground/5 dark:ring-foreground/10"
			>
				<ul id={listId} role="listbox">
					{#each filtered as tag, index (tag.id)}
						<!-- svelte-ignore a11y_click_events_have_key_events (keyboard handled by the input) -->
						<li
							role="option"
							aria-selected={index === activeIndex}
							class={cn(
								'cursor-pointer rounded-xl px-2.5 py-1.5',
								index === activeIndex && 'bg-accent text-accent-foreground'
							)}
							onmousedown={(event) => event.preventDefault()}
							onmouseenter={() => (activeIndex = index)}
							onclick={() => addTag(tag)}
						>
							{tag.name}
						</li>
					{/each}
					{#if canCreate}
						<!-- svelte-ignore a11y_click_events_have_key_events (keyboard handled by the input) -->
						<li
							role="option"
							aria-selected={activeIndex === filtered.length}
							class={cn(
								'flex cursor-pointer items-center gap-2 rounded-xl px-2.5 py-1.5',
								activeIndex === filtered.length && 'bg-accent text-accent-foreground'
							)}
							onmousedown={(event) => event.preventDefault()}
							onmouseenter={() => (activeIndex = filtered.length)}
							onclick={() => addFromText(query)}
						>
							<PlusIcon class="size-4" /> Create "{trimmedQuery}"
						</li>
					{/if}
				</ul>
			</PopoverPrimitive.Content>
		</PopoverPrimitive.Portal>
	{/if}
</PopoverPrimitive.Root>
