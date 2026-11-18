<script module lang="ts">
	import { format as formatWith } from 'date-fns';
	import { Badge } from '#lib/components/ui/badge/index.js';

	export { textCell, dateTimeCell, tagsCell, booleanCell };

	function formatDate(value: unknown, format?: string): string {
		if (value == null || value === '') return '';
		const date = value instanceof Date ? value : new Date(String(value));
		if (Number.isNaN(date.getTime())) return '';
		return format ? formatWith(date, format) : date.toLocaleString();
	}
</script>

{#snippet textCell(value: string)}
	<p>{value}</p>
{/snippet}

{#snippet dateTimeCell({ value, format }: { value: unknown; format?: string })}
	<p>{formatDate(value, format)}</p>
{/snippet}

{#snippet tagsCell(names: string[])}
	<div class="flex flex-wrap gap-1">
		{#each names as name, index (index)}
			<Badge variant="secondary">{name}</Badge>
		{/each}
	</div>
{/snippet}

{#snippet booleanCell(value: boolean)}
	<input type="checkbox" checked={value} disabled />
{/snippet}
