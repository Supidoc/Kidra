import { describe, expect, it } from 'vitest';
import { pageItems } from './pagination.ts';

describe('pageItems', () => {
	it('lists every page up to 7 pages', () => {
		expect(pageItems(0, 0)).toEqual([]);
		expect(pageItems(2, 7)).toEqual([0, 1, 2, 3, 4, 5, 6]);
	});

	it('shows the first pages near the start', () => {
		expect(pageItems(3, 20)).toEqual([0, 1, 2, 3, 4, 'ellipsis', 19]);
	});

	it('shows the last pages near the end', () => {
		expect(pageItems(16, 20)).toEqual([0, 'ellipsis', 15, 16, 17, 18, 19]);
	});

	it('shows the current page with its neighbours in the middle', () => {
		expect(pageItems(10, 20)).toEqual([0, 'ellipsis', 9, 10, 11, 'ellipsis', 19]);
	});
});
