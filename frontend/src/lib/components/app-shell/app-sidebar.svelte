<script lang="ts">
	import * as Sidebar from '#lib/components/ui/sidebar/index.js';
	import { GalleryVerticalEndIcon, Moon, Sun } from '@lucide/svelte';
	import type { ComponentProps } from 'svelte';
	import { page } from '$app/state';
	import { navigation } from '#lib/navigation.ts';
	import { mode, toggleMode } from 'mode-watcher';
	import NavUser from './nav-user.svelte';
	import { version } from '$app/env';

	let { ref = $bindable(null), ...restProps }: ComponentProps<typeof Sidebar.Root> = $props();

	function isActive(url: string) {
		return page.url.pathname === url || page.url.pathname.startsWith(url + '/');
	}
</script>

<Sidebar.Root {...restProps} bind:ref>
	<Sidebar.Header>
		<Sidebar.Menu>
			<Sidebar.MenuItem>
				<Sidebar.MenuButton size="lg">
					{#snippet child({ props })}
						<a href="/app/master-data" {...props}>
							<div
								class="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground"
							>
								<GalleryVerticalEndIcon class="size-4" />
							</div>
							<div class="flex flex-col gap-0.5 leading-none">
								<span class="font-medium">KIDRA</span>
								<span class="">v{version}</span>
							</div>
						</a>
					{/snippet}
				</Sidebar.MenuButton>
			</Sidebar.MenuItem>
		</Sidebar.Menu>
	</Sidebar.Header>
	<Sidebar.Content>
		<Sidebar.Group>
			<Sidebar.Menu>
				{#each navigation as item (item.title)}
					<Sidebar.MenuItem>
						<Sidebar.MenuButton isActive={item.url === page.url.pathname} class="font-medium">
							{#snippet child({ props })}
								<a href={item.url} {...props}>
									{item.title}
								</a>
							{/snippet}
						</Sidebar.MenuButton>
						{#if item.items?.length}
							<Sidebar.MenuSub>
								{#each item.items as subItem (subItem.title)}
									<Sidebar.MenuSubItem>
										<Sidebar.MenuSubButton isActive={isActive(subItem.url)} class="font-medium">
											{#snippet child({ props })}
												<a href={subItem.url} {...props}>{subItem.title}</a>
											{/snippet}
										</Sidebar.MenuSubButton>
									</Sidebar.MenuSubItem>
								{/each}
							</Sidebar.MenuSub>
						{/if}
					</Sidebar.MenuItem>
				{/each}
			</Sidebar.Menu>
		</Sidebar.Group>
	</Sidebar.Content>
	<Sidebar.Footer>
		<Sidebar.Menu>
			<Sidebar.MenuItem>
				<Sidebar.MenuButton size="lg">
					{#snippet child({ props })}
						<button {...props} onclick={toggleMode}>
							<div
								class="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground"
							>
								{#if mode.current == 'light'}
									<Sun class="size-4" />
								{:else}
									<Moon class="size-4" />
								{/if}
							</div>
							<div class="flex flex-col gap-0.5 leading-none">
								<span class="font-medium">{mode.current == 'light' ? 'Light' : 'Dark'}</span>
								<span class="">Theme</span>
							</div>
						</button>
					{/snippet}
				</Sidebar.MenuButton>
			</Sidebar.MenuItem>
			<Sidebar.MenuItem>
				<NavUser />
			</Sidebar.MenuItem>
		</Sidebar.Menu>
	</Sidebar.Footer>
	<Sidebar.Rail />
</Sidebar.Root>
