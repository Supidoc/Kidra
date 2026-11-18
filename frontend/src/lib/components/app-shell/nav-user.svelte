<script lang="ts">
	import { ChevronsUpDownIcon, LogOutIcon } from '@lucide/svelte';
	import * as Avatar from '#lib/components/ui/avatar/index.js';
	import * as DropdownMenu from '#lib/components/ui/dropdown-menu/index.js';
	import * as Sidebar from '#lib/components/ui/sidebar/index.js';
	import { useSidebar } from '#lib/components/ui/sidebar/index.js';
	import { auth, avatarUrl, logout } from '#lib/data/auth.svelte.ts';
	import { goto } from '$app/navigation';

	const sidebar = useSidebar();

	const name: string = $derived(auth.record?.name ?? '');
	const email: string = $derived(auth.record?.email ?? '');
	const avatar = $derived(avatarUrl(auth.record));
	const initials = $derived(
		(name || email)
			.split(/\s+/)
			.map((word) => word[0])
			.join('')
			.slice(0, 2)
			.toUpperCase()
	);

	async function handleLogout() {
		logout();
		await goto('/login');
	}
</script>

{#snippet userHeader()}
	<Avatar.Root class="size-8 rounded-lg">
		<Avatar.Image src={avatar} alt={name} />
		<Avatar.Fallback class="rounded-lg">{initials}</Avatar.Fallback>
	</Avatar.Root>
	<div class="grid flex-1 text-start text-sm leading-tight">
		<span class="truncate font-medium">{name}</span>
		<span class="truncate text-xs">{email}</span>
	</div>
{/snippet}

<DropdownMenu.Root>
	<DropdownMenu.Trigger>
		{#snippet child({ props })}
			<Sidebar.MenuButton
				{...props}
				size="lg"
				class="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
			>
				{@render userHeader()}
				<ChevronsUpDownIcon class="ms-auto size-4" />
			</Sidebar.MenuButton>
		{/snippet}
	</DropdownMenu.Trigger>
	<DropdownMenu.Content
		class="w-(--bits-dropdown-menu-anchor-width) min-w-56 rounded-lg"
		side={sidebar.isMobile ? 'bottom' : 'right'}
		align="end"
		sideOffset={4}
	>
		<DropdownMenu.Label class="p-0 font-normal">
			<div class="flex items-center gap-2 px-1 py-1.5 text-start text-sm">
				{@render userHeader()}
			</div>
		</DropdownMenu.Label>
		<DropdownMenu.Separator />
		<DropdownMenu.Item onSelect={handleLogout}>
			<LogOutIcon />
			Log out
		</DropdownMenu.Item>
	</DropdownMenu.Content>
</DropdownMenu.Root>
