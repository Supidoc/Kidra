<script lang="ts">
	import type { Snippet } from 'svelte';
	import * as Sidebar from '#lib/components/ui/sidebar/index.js';
	import AppSidebar from '#lib/components/app-shell/app-sidebar.svelte';
	import Separator from '#lib/components/ui/separator/separator.svelte';
	import { findNavigationTitle } from '#lib/navigation.ts';
	import { page } from '$app/state';

	let { children }: { children: Snippet } = $props();

	const activeTitle = $derived(findNavigationTitle(page.url.pathname));
</script>

<Sidebar.Provider>
	<AppSidebar />
	<Sidebar.Inset>
		<header class="flex h-16 shrink-0 items-center gap-2 border-b px-4">
			<Sidebar.Trigger class="-ms-1" />
			<Separator orientation="vertical" class="me-2 data-vertical:h-4 data-vertical:self-auto" />
			<span>{activeTitle ?? ''}</span>
		</header>

		<div class="flex flex-1 flex-col gap-4 p-4">
			{@render children()}
		</div>
	</Sidebar.Inset>
</Sidebar.Provider>
