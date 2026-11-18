import { describe, expect, it, vi } from 'vitest';
import { NEW_ROW_KEY, TableEditState } from './edit-state.svelte.ts';

type Row = { id: string; name: string };

const a: Row = { id: 'a', name: 'A' };
const b: Row = { id: 'b', name: 'B' };

function setup(data: Row[] = [a, b], result?: boolean) {
	const onCreate = vi.fn(async () => result);
	const onUpdate = vi.fn(async () => result);
	const edit = new TableEditState<Row>({ data: () => data, onCreate, onUpdate });
	return { edit, onCreate, onUpdate, data };
}

describe('TableEditState', () => {
	it('shows the data while not editing', () => {
		const { edit, data } = setup();
		expect(edit.rows).toBe(data);
		expect(edit.isEditing).toBe(false);
	});

	it('startEdit edits one row at a time', () => {
		const { edit } = setup();
		edit.startEdit(a);
		expect(edit.isEditingRow('a')).toBe(true);
		edit.startEdit(b);
		expect(edit.editingRowId).toBe('a');
	});

	it('setCell marks a cell edited and unmarks it when the original value returns', () => {
		const { edit } = setup();
		edit.startEdit(a);
		edit.setCell('a', 'name', 'A2');
		expect(edit.isEdited('a', 'name')).toBe(true);
		expect(edit.hasChanges).toBe(true);
		expect(edit.rows[0].name).toBe('A2');

		edit.setCell('a', 'name', 'A');
		expect(edit.isEdited('a', 'name')).toBe(false);
		expect(edit.hasChanges).toBe(false);
	});

	it('ignores setCell for rows that are not being edited', () => {
		const { edit } = setup();
		edit.startEdit(a);
		edit.setCell('b', 'name', 'B2');
		expect(edit.rows[1].name).toBe('B');
		expect(edit.hasChanges).toBe(false);
	});

	it('save calls onUpdate only when the row changed', async () => {
		const { edit, onUpdate, onCreate } = setup();
		edit.startEdit(a);
		await edit.save();
		expect(onUpdate).not.toHaveBeenCalled();

		edit.startEdit(a);
		edit.setCell('a', 'name', 'A2');
		await edit.save();
		expect(onUpdate).toHaveBeenCalledWith({ id: 'a', name: 'A2' });
		expect(onCreate).not.toHaveBeenCalled();
		expect(edit.isEditing).toBe(false);
	});

	it('addRow puts the new row on top and save passes it to onCreate without a client key', async () => {
		const { edit, onCreate, onUpdate } = setup();
		edit.addRow({ id: '', name: '' });
		expect(edit.rows).toHaveLength(3);
		expect(edit.editingRowId).toBe(NEW_ROW_KEY);
		expect(edit.isNew(NEW_ROW_KEY)).toBe(true);

		edit.setCell(NEW_ROW_KEY, 'name', 'C');
		await edit.save();
		expect(onCreate).toHaveBeenCalledWith({ id: '', name: 'C' });
		expect(onUpdate).not.toHaveBeenCalled();
		expect(edit.newRowId).toBe(null);
	});

	it('keeps a non-empty id as the key of a new row', async () => {
		const { edit, onCreate } = setup();
		edit.addRow({ id: 'new-1', name: '' });
		expect(edit.editingRowId).toBe('new-1');
		await edit.save();
		expect(onCreate).toHaveBeenCalledWith({ id: 'new-1', name: '' });
	});

	it('cancel restores the data and drops a new row', () => {
		const { edit, data, onCreate, onUpdate } = setup();
		edit.startEdit(a);
		edit.setCell('a', 'name', 'A2');
		edit.cancel();
		expect(edit.rows).toBe(data);
		expect(edit.isEdited('a', 'name')).toBe(false);

		edit.addRow({ id: '', name: 'C' });
		edit.cancel();
		expect(edit.rows).toBe(data);
		expect(onCreate).not.toHaveBeenCalled();
		expect(onUpdate).not.toHaveBeenCalled();
	});

	it('display swaps in the draft of the edited row, also for rows outside the data', () => {
		const { edit } = setup();
		edit.startEdit(a);
		edit.setCell('a', 'name', 'A2');
		expect(edit.display(a)).toEqual({ id: 'a', name: 'A2' });
		expect(edit.display(b)).toBe(b);
	});

	it('keeps the draft in edit mode when the save handler returns false', async () => {
		const { edit, onUpdate } = setup(undefined, false);
		edit.startEdit(a);
		edit.setCell('a', 'name', 'A2');
		const saving = edit.save();
		expect(edit.saving).toBe(true);
		await saving;
		expect(onUpdate).toHaveBeenCalledWith({ id: 'a', name: 'A2' });
		expect(edit.saving).toBe(false);
		expect(edit.isEditingRow('a')).toBe(true);
		expect(edit.rows[0].name).toBe('A2');
		expect(edit.isEdited('a', 'name')).toBe(true);
	});

	it('keeps a new row when creating it fails', async () => {
		const { edit } = setup(undefined, false);
		edit.addRow({ id: '', name: 'C' });
		await edit.save();
		expect(edit.isNew(NEW_ROW_KEY)).toBe(true);
		expect(edit.rows).toHaveLength(3);
	});
});
