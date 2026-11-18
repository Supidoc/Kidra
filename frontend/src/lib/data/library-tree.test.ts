import { describe, expect, it } from 'vitest';
import { buildLibraryTree, buildTree, treeRecord } from './library-tree.ts';

const libraries = [
	{ id: 'lib1', name: 'Passives' },
	{ id: 'lib2', name: 'Empty' }
];
const items = [
	{ id: 'r', name: 'Resistor', library: 'lib1' },
	{ id: 'x', name: 'Orphan', library: 'missing' },
	{ id: 'n', name: 'No library' },
	{ id: 'c', name: 'Capacitor', library: 'lib1' }
];

describe('buildLibraryTree', () => {
	it('nests items under their library in order and gives every library children', () => {
		const tree = buildLibraryTree(libraries, items);
		expect(tree).toEqual([
			{
				id: 'lib1',
				name: 'Passives',
				kind: 'group',
				children: [
					{ id: 'r', name: 'Resistor', library: 'lib1', kind: 'item' },
					{ id: 'c', name: 'Capacitor', library: 'lib1', kind: 'item' }
				]
			},
			{ id: 'lib2', name: 'Empty', kind: 'group', children: [] }
		]);
	});

	it('leaves out items without a known library', () => {
		const ids = buildLibraryTree(libraries, items).flatMap((group) =>
			group.children.map((item) => item.id)
		);
		expect(ids).not.toContain('x');
		expect(ids).not.toContain('n');
	});
});

describe('buildTree', () => {
	it('groups by any relation', () => {
		const tree = buildTree([{ id: 's' }], [{ id: 'u', unitSet: 's' }], (unit) => unit.unitSet);
		expect(tree[0].children.map((unit) => unit.id)).toEqual(['u']);
	});
});

describe('treeRecord', () => {
	it('drops the tree fields', () => {
		const [group] = buildLibraryTree(libraries, items);
		expect(treeRecord(group)).toEqual({ id: 'lib1', name: 'Passives' });
		expect(treeRecord(group.children[0])).toEqual({ id: 'r', name: 'Resistor', library: 'lib1' });
	});
});
