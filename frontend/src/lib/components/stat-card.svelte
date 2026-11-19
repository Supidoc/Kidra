<script lang="ts">
	import type { Component, Snippet } from 'svelte';
	import * as Card from '#lib/components/ui/card/index.js';

	type Props = {
		/** Label above the number, e.g. "Total Categories". */
		title: string;
		count: number;
		/** Lucide icon component shown in the top right corner. */
		icon: Component<{ size?: number | string }>;
		/** Page the card links to. */
		href: string;
		/** Flavor text in the footer. */
		footer?: Snippet;
	};

	let { title, count, icon: Icon, href, footer }: Props = $props();
</script>

<a
	{href}
	class="block h-full rounded-4xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
>
	<Card.Root
		class="@container/card h-full bg-linear-to-t from-primary/5 to-card pb-0 shadow-xs dark:bg-card"
	>
		<Card.Header>
			<Card.Description class="text-2xl">{title}</Card.Description>
			<Card.Title class="text-3xl font-semibold tabular-nums">{count}</Card.Title>
			<Card.Action>
				<Icon size={40} />
			</Card.Action>
		</Card.Header>
		<Card.Footer class="mt-auto h-full flex-col items-start gap-1.5 border-t bg-muted pb-6 text-sm">
			<div class="line-clamp-3 font-medium">{@render footer?.()}</div>
		</Card.Footer>
	</Card.Root>
</a>
