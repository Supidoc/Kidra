<script lang="ts">
	import { ExternalLinkIcon, RefreshCwIcon } from '@lucide/svelte';
	import {
		createColumns,
		DataTable,
		type RowActionContext
	} from '#lib/components/data-table/index.js';
	import { Badge } from '#lib/components/ui/badge/index.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import { createPartChecks } from '#lib/data/part-checks.svelte.ts';

	const checks = createPartChecks();
	checks.load();

	type IssueRow = {
		id: string;
		partId: string;
		severity: string;
		part: string;
		mpn: string;
		symbol: string;
		footprint: string;
		message: string;
	};

	const rows = $derived.by((): IssueRow[] => {
		const parts = new Map(checks.parts.map((part) => [part.id, part]));
		const symbols = new Map(checks.symbols.map((symbol) => [symbol.id, symbol.name]));
		const footprints = new Map(
			checks.footprints.map((footprint) => [footprint.id, footprint.name])
		);
		return checks.issues.map((issue) => {
			const part = parts.get(issue.partId);
			return {
				id: issue.id,
				partId: issue.partId,
				severity: issue.severity === 'error' ? 'Error' : 'Warning',
				part: part?.valueRaw ?? issue.partId,
				mpn: part?.manufacturerNumber ?? '',
				symbol: (part?.symbol && symbols.get(part.symbol)) || '',
				footprint: (part?.footprint && footprints.get(part.footprint)) || '',
				message: issue.message
			};
		});
	});

	const columns = createColumns<IssueRow>([
		{ header: 'Severity', accessor: 'severity', type: 'text', searchable: true },
		{ header: 'Part', accessor: 'part', type: 'text', searchable: true },
		{ header: 'MPN', accessor: 'mpn', type: 'text', searchable: true },
		{ header: 'Symbol', accessor: 'symbol', type: 'text', searchable: true },
		{ header: 'Footprint', accessor: 'footprint', type: 'text', searchable: true },
		{ header: 'Issue', accessor: 'message', type: 'text', searchable: true }
	]);
</script>

{#snippet title()}
	<div class="flex items-center gap-2">
		<h2 class="text-base font-semibold whitespace-nowrap">Part checks</h2>
		{#if checks.loaded && !checks.failed}
			<Badge variant={checks.counts.error ? 'destructive' : 'secondary'}>
				{checks.counts.error} error{checks.counts.error === 1 ? '' : 's'}
			</Badge>
			<Badge variant="outline">
				{checks.counts.warning} warning{checks.counts.warning === 1 ? '' : 's'}
			</Badge>
		{/if}
		<Button
			size="icon-sm"
			variant="ghost"
			aria-label="Run checks again"
			title="Run checks again"
			disabled={checks.loading}
			onclick={() => checks.load()}><RefreshCwIcon /></Button
		>
	</div>
{/snippet}

{#snippet issueActions({ row }: RowActionContext<IssueRow>)}
	<Button
		size="sm"
		variant="ghost"
		href={`/app/application/parts?part=${encodeURIComponent(row.partId)}`}
		aria-label={`Open part ${row.part}`}><ExternalLinkIcon />Open part</Button
	>
{/snippet}

<p class="text-sm text-muted-foreground">
	Errors: the part's symbol or footprint is not set, was deleted, or is no longer in the library
	repository. Warnings: the symbol's pin count differs from the footprint's pad count; this is fine
	for thermal or mounting pads and NC pins.
</p>

{#if checks.failed}
	<p class="text-sm text-destructive">
		Could not load all data, so the checks were not run. Try again with the refresh button.
	</p>
{/if}

<DataTable data={rows} {columns} {title} rowActions={issueActions} />
