import { describe, expect, it } from 'vitest';
import { checkParts, countIssues } from './checks.ts';

const symbol = (id: string, extra: { available?: boolean; pinCount?: number } = {}) => ({
	id,
	name: `Sym_${id}`,
	available: true,
	pinCount: 0,
	...extra
});
const footprint = (id: string, extra: { available?: boolean; padCount?: number } = {}) => ({
	id,
	name: `Fp_${id}`,
	available: true,
	padCount: 0,
	...extra
});
const part = (id: string, symbolId = 's', footprintId = 'f') => ({
	id,
	symbol: symbolId,
	footprint: footprintId
});

describe('checkParts', () => {
	it('reports nothing for a healthy part', () => {
		expect(
			checkParts([part('p')], [symbol('s', { pinCount: 3 })], [footprint('f', { padCount: 3 })])
		).toEqual([]);
	});

	it('reports a missing or deleted symbol as an error', () => {
		const issues = checkParts(
			[part('none', ''), part('gone', 'deleted')],
			[symbol('s')],
			[footprint('f')]
		);
		expect(issues).toEqual([
			{
				id: 'none:symbol-missing',
				partId: 'none',
				severity: 'error',
				rule: 'symbol-missing',
				message: 'No symbol assigned.'
			},
			{
				id: 'gone:symbol-missing',
				partId: 'gone',
				severity: 'error',
				rule: 'symbol-missing',
				message: 'The assigned symbol no longer exists.'
			}
		]);
	});

	it('reports a missing or deleted footprint as an error', () => {
		const issues = checkParts(
			[part('none', 's', ''), part('gone', 's', 'deleted')],
			[symbol('s')],
			[footprint('f')]
		);
		expect(issues.map((issue) => [issue.partId, issue.rule, issue.severity])).toEqual([
			['none', 'footprint-missing', 'error'],
			['gone', 'footprint-missing', 'error']
		]);
	});

	it('reports unavailable symbols and footprints, but not unknown availability', () => {
		const issues = checkParts(
			[part('a', 's1', 'f1'), part('b', 's2', 'f2')],
			[symbol('s1', { available: false }), { id: 's2', name: 'S2' }],
			[footprint('f1', { available: false }), { id: 'f2', name: 'F2' }]
		);
		expect(issues).toEqual([
			expect.objectContaining({
				partId: 'a',
				rule: 'symbol-unavailable',
				severity: 'error',
				message: 'Symbol "Sym_s1" is not available in the library.'
			}),
			expect.objectContaining({
				partId: 'a',
				rule: 'footprint-unavailable',
				severity: 'error',
				message: 'Footprint "Fp_f1" is not available in the library.'
			})
		]);
	});

	it('warns when pin and pad counts differ', () => {
		const [issue, ...rest] = checkParts(
			[part('p')],
			[symbol('s', { pinCount: 8 })],
			[footprint('f', { padCount: 9 })]
		);
		expect(rest).toEqual([]);
		expect(issue).toEqual({
			id: 'p:pin-pad-mismatch',
			partId: 'p',
			severity: 'warning',
			rule: 'pin-pad-mismatch',
			message: 'Symbol has 8 pins, footprint has 9 pads (fine for thermal pads or NC pins).'
		});
	});

	it('uses singular wording for one pin or pad', () => {
		const [issue] = checkParts(
			[part('p')],
			[symbol('s', { pinCount: 1 })],
			[footprint('f', { padCount: 2 })]
		);
		expect(issue.message).toMatch(/^Symbol has 1 pin, footprint has 2 pads/);
	});

	it('does not compare unknown (0 or missing) counts', () => {
		const issues = checkParts(
			[part('a', 's0', 'f5'), part('b', 's5', 'f0'), part('c', 'sx', 'fx')],
			[symbol('s0'), symbol('s5', { pinCount: 5 }), { id: 'sx', name: 'X' }],
			[footprint('f0'), footprint('f5', { padCount: 5 }), { id: 'fx', name: 'X' }]
		);
		expect(issues).toEqual([]);
	});

	it('still compares counts of unavailable records', () => {
		const issues = checkParts(
			[part('p')],
			[symbol('s', { available: false, pinCount: 2 })],
			[footprint('f', { padCount: 3 })]
		);
		expect(issues.map((issue) => issue.rule)).toEqual(['symbol-unavailable', 'pin-pad-mismatch']);
	});

	it('does not compare counts when the symbol or footprint is missing', () => {
		const issues = checkParts([part('p', 's', 'gone')], [symbol('s', { pinCount: 2 })], []);
		expect(issues.map((issue) => issue.rule)).toEqual(['footprint-missing']);
	});

	it('lists errors before warnings and keeps the part order within a severity', () => {
		const issues = checkParts(
			[part('w1', 's2', 'f3'), part('e1', ''), part('w2', 's2', 'f3'), part('e2', 's', '')],
			[symbol('s'), symbol('s2', { pinCount: 2 })],
			[footprint('f'), footprint('f3', { padCount: 3 })]
		);
		expect(issues.map((issue) => `${issue.severity}:${issue.partId}`)).toEqual([
			'error:e1',
			'error:e2',
			'warning:w1',
			'warning:w2'
		]);
	});

	it('gives every issue a unique id', () => {
		const issues = checkParts([part('p', '', '')], [], []);
		expect(new Set(issues.map((issue) => issue.id)).size).toBe(issues.length);
		expect(issues).toHaveLength(2);
	});

	it('returns nothing without parts', () => {
		expect(checkParts([], [symbol('s')], [footprint('f')])).toEqual([]);
	});
});

describe('countIssues', () => {
	it('counts errors and warnings', () => {
		expect(
			countIssues([{ severity: 'error' }, { severity: 'warning' }, { severity: 'error' }])
		).toEqual({ error: 2, warning: 1 });
		expect(countIssues([])).toEqual({ error: 0, warning: 0 });
	});
});
