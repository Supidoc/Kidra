import { describe, expect, it } from 'vitest';
import { createColumns, getNestedValue, optionLabel, tagNames } from './columns.ts';

describe('getNestedValue', () => {
	it('reads dotted paths', () => {
		expect(
			getNestedValue({ expand: { category: { name: 'Resistor' } } }, 'expand.category.name')
		).toBe('Resistor');
	});

	it('returns undefined for missing or non-object steps', () => {
		expect(getNestedValue({ expand: null }, 'expand.category.name')).toBeUndefined();
		expect(getNestedValue({ name: 'x' }, 'name.length')).toBeUndefined();
		expect(getNestedValue(undefined, 'name')).toBeUndefined();
	});
});

describe('tagNames', () => {
	it('accepts strings and records with a name, sorted', () => {
		expect(tagNames(['smd', { name: 'Audio' }, { name: '' }, { id: 'x' }, 3])).toEqual([
			'Audio',
			'smd'
		]);
	});

	it('returns [] for non-arrays', () => {
		expect(tagNames(undefined)).toEqual([]);
		expect(tagNames('smd')).toEqual([]);
	});
});

describe('optionLabel', () => {
	const config = {
		options: [{ id: 'a', label: 'Alpha' }],
		groups: [{ id: 'g', label: 'Group', options: [{ id: 'b', label: 'Beta' }] }]
	};

	it('finds flat and grouped options', () => {
		expect(optionLabel(config, 'a')).toBe('Alpha');
		expect(optionLabel(config, 'b')).toBe('Beta');
	});

	it('falls back to the id, and to "" for empty values', () => {
		expect(optionLabel(config, 'zzz')).toBe('zzz');
		expect(optionLabel(config, '')).toBe('');
		expect(optionLabel(config, null)).toBe('');
	});
});

describe('createColumns', () => {
	type Row = { id: string; distributor: string; expand?: { distributor?: { name: string } } };

	it('uses the label accessor, then the option label, as the combobox search value', () => {
		const [column] = createColumns<Row>([
			{
				header: 'Distributor',
				accessor: 'distributor',
				labelAccessor: 'expand.distributor.name',
				type: 'combobox',
				options: [{ id: 'd1', label: 'Mouser' }]
			}
		]);
		const read = 'accessorFn' in column ? column.accessorFn : undefined;
		expect(
			read?.({ id: '1', distributor: 'd1', expand: { distributor: { name: 'DigiKey' } } }, 0)
		).toBe('DigiKey');
		expect(read?.({ id: '1', distributor: 'd1' }, 0)).toBe('Mouser');
	});

	it('marks columns editable via meta, per row when editable is a function', () => {
		const [fixed, perRow] = createColumns<Row>([
			{ header: 'A', accessor: 'id', type: 'text' },
			{ header: 'B', accessor: 'distributor', type: 'text', editable: (row) => row.id !== 'x' }
		]);
		expect(fixed.meta?.editable).toBe(false);
		const editable = perRow.meta?.editable;
		expect(editable && editable({ id: 'x', distributor: '' })).toBe(false);
		expect(editable && editable({ id: 'y', distributor: '' })).toBe(true);
	});

	it('rejects editable columns without a top-level accessor', () => {
		expect(() =>
			createColumns<Row>([
				{ header: 'Name', accessor: 'expand.distributor.name', type: 'text', editable: true }
			])
		).toThrow();
	});
});
