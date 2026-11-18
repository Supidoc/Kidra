import type { FootprintsRecord, PartsRecord, SymbolsRecord } from './pocketbase-types.ts';

/*
 * Integrity checks of the part library. Pure functions; the checks page loads the records.
 */

export type IssueSeverity = 'error' | 'warning';

export type IssueRule =
	| 'symbol-missing'
	| 'symbol-unavailable'
	| 'footprint-missing'
	| 'footprint-unavailable'
	| 'pin-pad-mismatch';

export type PartIssue = {
	/** Unique within one result: `${partId}:${rule}`. */
	id: string;
	partId: string;
	severity: IssueSeverity;
	rule: IssueRule;
	message: string;
};

type CheckedPart = Pick<PartsRecord, 'id' | 'symbol' | 'footprint'>;
type CheckedSymbol = Pick<SymbolsRecord, 'id' | 'name' | 'available' | 'pinCount'>;
type CheckedFootprint = Pick<FootprintsRecord, 'id' | 'name' | 'available' | 'padCount'>;

const severityOrder: Record<IssueSeverity, number> = { error: 0, warning: 1 };

/**
 * Checks every part against its symbol and footprint:
 *
 * - **error** when the symbol or footprint is not set, no longer exists, or is marked
 *   `available === false` (no longer found in the library repository);
 * - **warning** when both a pin count and a pad count are known (> 0) and differ. This is
 *   only a hint: thermal/exposed pads, mounting pads and NC pins make it legitimate.
 *
 * Counts of 0 or missing mean "unknown" (e.g. not parsed yet) and are not compared.
 * The result is sorted by severity (errors first), keeping the order of `parts` within it.
 */
export function checkParts(
	parts: CheckedPart[],
	symbols: CheckedSymbol[],
	footprints: CheckedFootprint[]
): PartIssue[] {
	const symbolsById = new Map(symbols.map((symbol) => [symbol.id, symbol]));
	const footprintsById = new Map(footprints.map((footprint) => [footprint.id, footprint]));
	const issues: PartIssue[] = [];

	for (const part of parts) {
		const add = (severity: IssueSeverity, rule: IssueRule, message: string) =>
			issues.push({ id: `${part.id}:${rule}`, partId: part.id, severity, rule, message });

		const symbol = part.symbol ? symbolsById.get(part.symbol) : undefined;
		if (!part.symbol) add('error', 'symbol-missing', 'No symbol assigned.');
		else if (!symbol) add('error', 'symbol-missing', 'The assigned symbol no longer exists.');
		else if (symbol.available === false)
			add(
				'error',
				'symbol-unavailable',
				`Symbol "${symbol.name}" is not available in the library.`
			);

		const footprint = part.footprint ? footprintsById.get(part.footprint) : undefined;
		if (!part.footprint) add('error', 'footprint-missing', 'No footprint assigned.');
		else if (!footprint)
			add('error', 'footprint-missing', 'The assigned footprint no longer exists.');
		else if (footprint.available === false)
			add(
				'error',
				'footprint-unavailable',
				`Footprint "${footprint.name}" is not available in the library.`
			);

		const pins = symbol?.pinCount ?? 0;
		const pads = footprint?.padCount ?? 0;
		if (pins > 0 && pads > 0 && pins !== pads) {
			add(
				'warning',
				'pin-pad-mismatch',
				`Symbol has ${pins} pin${pins === 1 ? '' : 's'}, footprint has ${pads} pad${pads === 1 ? '' : 's'} ` +
					'(fine for thermal pads or NC pins).'
			);
		}
	}

	// Array.prototype.sort is stable, so parts keep their order within a severity.
	return issues.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);
}

/** Number of issues per severity. */
export function countIssues(issues: Pick<PartIssue, 'severity'>[]) {
	return {
		error: issues.filter((issue) => issue.severity === 'error').length,
		warning: issues.filter((issue) => issue.severity === 'warning').length
	};
}
