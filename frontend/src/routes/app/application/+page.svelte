<script lang="ts">
	import { LayoutListIcon, ListChecksIcon } from '@lucide/svelte';
	import StatCard from '#lib/components/stat-card.svelte';
	import { createPartChecks } from '#lib/data/part-checks.svelte.ts';
	import { getCollectionStats, type CollectionStats } from '#lib/data/stats.ts';
	import type { PartsRecord } from '#lib/data/pocketbase-types.ts';

	let parts: CollectionStats<PartsRecord> = $state({ count: 0, latest: null });

	getCollectionStats<PartsRecord>('parts').then((stats) => (parts = stats));

	const checks = createPartChecks();
	checks.load();
</script>

<div class="grid grid-cols-1 gap-4 px-4 sm:grid-cols-2 lg:px-6 xl:grid-cols-4">
	<StatCard
		title="Total Parts"
		href="/app/application/parts"
		icon={LayoutListIcon}
		count={parts.count}
	>
		{#snippet footer()}
			{#if parts.latest}
				<p>Latest: <span class="font-bold">{parts.latest.valueRaw}</span></p>
			{/if}
		{/snippet}
	</StatCard>
	<StatCard
		title="Check Issues"
		href="/app/application/checks"
		icon={ListChecksIcon}
		count={checks.issues.length}
	>
		{#snippet footer()}
			{#if checks.failed}
				<p>Checks could not be run.</p>
			{:else if checks.loaded}
				<p>
					<span class="font-bold">{checks.counts.error}</span> errors,
					<span class="font-bold">{checks.counts.warning}</span> warnings
				</p>
			{/if}
		{/snippet}
	</StatCard>
</div>
