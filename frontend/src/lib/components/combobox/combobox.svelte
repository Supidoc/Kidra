<script lang="ts">
	import ChevronDownIcon from '@lucide/svelte/icons/chevron-down';
	import { tick } from 'svelte';
	import * as Command from '#lib/components/ui/command/index.js';
	import * as Popover from '#lib/components/ui/popover/index.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import { cn } from '#lib/utils.js';

	export type ComboboxOption = { id: string; label: string };
	export type ComboboxGroup = { id: string; label: string; options: ComboboxOption[] };

	type Props = {
		/** Id of the trigger button, so a `<label for>` can target it. */
		id?: string;
		/** Marks the trigger as invalid (`aria-invalid`), which also applies the error styling. */
		invalid?: boolean;
		value?: string;
		options?: ComboboxOption[];
		groups?: ComboboxGroup[];
		placeholder?: string;
		searchPlaceholder?: string;
		disabled?: boolean;
		onChange?: (value: string) => void;
		/** Extra classes merged into the trigger button. */
		class?: string;
		/** Keydown handler on the trigger button, run after the popover's own handler. */
		onkeydown?: (event: KeyboardEvent) => void;
	};

	let {
		id,
		invalid = false,
		value = $bindable(''),
		options = [],
		groups = [],
		placeholder = 'Select an option',
		searchPlaceholder = 'Search...',
		disabled = false,
		onChange,
		class: className,
		onkeydown
	}: Props = $props();

	let open = $state(false);
	let triggerRef = $state<HTMLButtonElement>(null!);
	const allOptions = $derived(groups.flatMap((group) => group.options).concat(options));
	const selectedLabel = $derived(
		allOptions.find((option) => option.id === value)?.label ?? placeholder
	);

	function closeAndFocusTrigger() {
		open = false;
		tick().then(() => triggerRef?.focus());
	}

	function selectValue(nextValue: string) {
		value = nextValue;
		onChange?.(nextValue);
		closeAndFocusTrigger();
	}
</script>

<Popover.Root bind:open>
	<Popover.Trigger bind:ref={triggerRef} {id} {disabled}>
		{#snippet child({ props })}
			<Button
				{...props}
				variant="secondary"
				{disabled}
				class={cn(
					'h-9 w-full min-w-0 justify-between rounded-3xl border border-input bg-transparent px-2.5 py-1 text-base font-normal shadow-xs transition-[color,box-shadow] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40',
					className
				)}
				onkeydown={(event: KeyboardEvent) => {
					(props.onkeydown as ((event: KeyboardEvent) => void) | undefined)?.(event);
					onkeydown?.(event);
				}}
				role="combobox"
				aria-expanded={open}
				aria-invalid={invalid || undefined}
			>
				<span class="truncate" class:text-muted-foreground={!value}>{selectedLabel}</span>
				<ChevronDownIcon class="shrink-0 text-muted-foreground" />
			</Button>
		{/snippet}
	</Popover.Trigger>
	<Popover.Content class="w-(--bits-popover-trigger-width) p-0" align="start">
		<Command.Root>
			<Command.Input placeholder={searchPlaceholder} />
			<Command.List>
				<Command.Empty>No results found.</Command.Empty>
				{#if groups.length}
					{#each groups as group, index (group.id)}
						<Command.Group heading={group.label}>
							{#each group.options as option (option.id)}
								<Command.Item
									value={option.label}
									data-checked={value === option.id}
									onSelect={() => {
										selectValue(option.id);
									}}>{option.label}</Command.Item
								>
							{/each}
						</Command.Group>
						{#if index < groups.length - 1}<Command.Separator />{/if}
					{/each}
				{:else}
					<Command.Group>
						{#each options as option (option.id)}
							<Command.Item
								value={option.label}
								data-checked={value === option.id}
								onSelect={() => {
									selectValue(option.id);
								}}>{option.label}</Command.Item
							>
						{/each}
					</Command.Group>
				{/if}
			</Command.List>
		</Command.Root>
	</Popover.Content>
</Popover.Root>
