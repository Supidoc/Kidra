import { beforeEach, describe, expect, it, vi } from 'vitest';

type Row = { id: string; name: string };

const service = {
	getFullList: vi.fn(),
	create: vi.fn(),
	update: vi.fn(),
	delete: vi.fn()
};

vi.mock('#lib/data/client.ts', () => ({ pb: { collection: () => service } }));
vi.mock('#lib/notify.ts', () => ({
	notify: { error: vi.fn(), warning: vi.fn(), success: vi.fn() }
}));

const { createCollection } = await import('./collection.svelte.ts');
const { notify } = await import('#lib/notify.ts');

async function loadedCollection(rows: Row[]) {
	service.getFullList.mockResolvedValueOnce(rows);
	const collection = createCollection<Row>('categories', { label: 'category' });
	await collection.load();
	return collection;
}

describe('createCollection', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('load sets data', async () => {
		const collection = await loadedCollection([{ id: 'a', name: 'A' }]);
		expect(collection.data).toEqual([{ id: 'a', name: 'A' }]);
		expect(collection.loading).toBe(false);
	});

	it('create appends the created records', async () => {
		const collection = await loadedCollection([{ id: 'a', name: 'A' }]);
		service.create.mockResolvedValueOnce({ id: 'b', name: 'B' });

		expect(await collection.create([{ id: '', name: 'B' }])).toBe(true);
		expect(collection.data).toEqual([
			{ id: 'a', name: 'A' },
			{ id: 'b', name: 'B' }
		]);
	});

	it('update replaces the row with the server response', async () => {
		const collection = await loadedCollection([
			{ id: 'a', name: 'A' },
			{ id: 'b', name: 'B' }
		]);
		service.update.mockResolvedValueOnce({ id: 'a', name: 'A2' });

		expect(await collection.update([{ id: 'a', name: 'A2' }])).toBe(true);
		expect(collection.data).toEqual([
			{ id: 'a', name: 'A2' },
			{ id: 'b', name: 'B' }
		]);
	});

	it('remove filters the row out', async () => {
		const collection = await loadedCollection([
			{ id: 'a', name: 'A' },
			{ id: 'b', name: 'B' }
		]);
		service.delete.mockResolvedValueOnce(true);

		expect(await collection.remove({ id: 'a', name: 'A' })).toBe(true);
		expect(collection.data).toEqual([{ id: 'b', name: 'B' }]);
	});

	it('reports failures through notify.error and returns false', async () => {
		const collection = await loadedCollection([{ id: 'a', name: 'A' }]);
		service.delete.mockRejectedValueOnce(new Error('offline'));

		expect(await collection.remove({ id: 'a', name: 'A' })).toBe(false);
		expect(collection.data).toEqual([{ id: 'a', name: 'A' }]);
		expect(notify.error).toHaveBeenCalledWith('Failed to delete category: offline');
	});

	it('returns false when loading fails', async () => {
		service.getFullList.mockRejectedValueOnce(new Error('offline'));
		const collection = createCollection<Row>('categories', { label: 'category' });

		expect(await collection.load()).toBe(false);
		expect(notify.error).toHaveBeenCalledWith('Failed to load category: offline');
	});
});
