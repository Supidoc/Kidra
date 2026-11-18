import { checkParts, countIssues } from './checks.ts';
import { createCollection } from './collection.svelte.ts';
import type { FootprintsRecord, PartsRecord, SymbolsRecord } from './pocketbase-types.ts';

/**
 * Loads what the integrity checks need (parts, symbols, footprints; only the fields used)
 * and exposes the issues reactively. Call `load()` to (re)load; failures show a toast and
 * set `failed`, and the issues stay empty then (a missing symbol list would otherwise turn
 * into an error for every part).
 */
export function createPartChecks() {
	const parts = createCollection<PartsRecord>('parts', {
		label: 'parts',
		listOptions: { fields: 'id,valueRaw,manufacturerNumber,symbol,footprint', sort: 'valueRaw' }
	});
	const symbols = createCollection<SymbolsRecord>('symbols', {
		label: 'symbols',
		listOptions: { fields: 'id,name,library,available,pinCount' }
	});
	const footprints = createCollection<FootprintsRecord>('footprints', {
		label: 'footprints',
		listOptions: { fields: 'id,name,library,available,padCount' }
	});

	let loaded = $state(false);
	let failed = $state(false);
	const issues = $derived(
		loaded && !failed ? checkParts(parts.data, symbols.data, footprints.data) : []
	);
	const counts = $derived(countIssues(issues));

	return {
		get parts() {
			return parts.data;
		},
		get symbols() {
			return symbols.data;
		},
		get footprints() {
			return footprints.data;
		},
		get issues() {
			return issues;
		},
		get counts() {
			return counts;
		},
		/** True once the first load finished (successfully or not). */
		get loaded() {
			return loaded;
		},
		/** The last load of at least one collection failed. */
		get failed() {
			return failed;
		},
		get loading() {
			return parts.loading || symbols.loading || footprints.loading;
		},
		async load() {
			const results = await Promise.all([parts.load(), symbols.load(), footprints.load()]);
			failed = results.includes(false);
			loaded = true;
		}
	};
}
