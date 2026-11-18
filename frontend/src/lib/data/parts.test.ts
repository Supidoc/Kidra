import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AttachmentsRecord, PartsRecord, TagsRecord } from './pocketbase-types.ts';

const requests: unknown[][] = [];
const send = vi.fn();
const batch = {
	collection: (name: string) => ({
		create: (body: unknown) => requests.push([name, 'create', body]),
		update: (id: string, body: unknown) => requests.push([name, 'update', id, body]),
		delete: (id: string) => requests.push([name, 'delete', id])
	}),
	send
};

vi.mock('./client.ts', () => ({ pb: { createBatch: () => batch } }));

const upload = vi.fn();
vi.mock('./attachments.ts', () => ({ uploadAttachment: upload }));

const { newRecordId, planPartSave, savePart } = await import('./parts.ts');
type SavePartInput = import('./parts.ts').SavePartInput;
type AttachmentDraft = import('./parts.ts').AttachmentDraft;

const now = '2026-01-01T00:00:00.000Z' as PartsRecord['created'];

function part(overrides: Partial<PartsRecord> = {}): PartsRecord {
	return {
		id: '',
		valueRaw: '10k',
		category: 'cat1',
		designator: 'des1',
		symbol: 'sym1',
		footprint: 'fp1',
		status: 'Active',
		version: 1,
		created: now,
		updated: now,
		...overrides
	};
}

const existingTags: TagsRecord[] = [
	{ id: 'tagresistor0001', name: 'Resistor', created: now, updated: now }
];

function input(overrides: Partial<SavePartInput> = {}): SavePartInput {
	return {
		part: part(),
		previous: null,
		ratings: [],
		distributorParts: [],
		attachments: [],
		primaryDatasheetId: '',
		tags: [],
		existingTags,
		saved: { ratings: [], distributorParts: [], attachments: [] },
		...overrides
	};
}

function attachment(overrides: Partial<AttachmentDraft> = {}): AttachmentDraft {
	return {
		id: 'att1',
		name: 'Sheet',
		url: '',
		kind: 'datasheet',
		description: '',
		file: null,
		...overrides
	};
}

function savedAttachment(overrides: Partial<AttachmentsRecord> = {}): AttachmentsRecord {
	return {
		id: 'att1',
		name: 'Sheet',
		url: '',
		kind: 'datasheet',
		description: '',
		file: 'sheet_abc.pdf' as AttachmentsRecord['file'],
		created: now,
		updated: now,
		...overrides
	};
}

function sequentialIds() {
	let next = 0;
	return () => `id${++next}`;
}

describe('newRecordId', () => {
	it('matches the PocketBase id format', () => {
		expect(newRecordId()).toMatch(/^[a-z0-9]{15}$/);
	});
});

describe('planPartSave', () => {
	it('creates a new part with its new rows, tags and a link-only attachment', () => {
		const { partId, operations } = planPartSave(
			input({
				ratings: [{ id: 'new-1', key: ' Power ', value: '0.25W ' }],
				distributorParts: [{ id: 'new-2', distributor: 'dist1', distributorNumber: ' 123 ' }],
				attachments: [
					attachment({ id: 'new-9', name: ' Sheet ', url: ' https://example.com/a.pdf ' })
				],
				primaryDatasheetId: 'new-9',
				tags: [
					{ id: 'new-3', name: 'resistor' },
					{ id: 'new-4', name: 'SMD' }
				]
			}),
			sequentialIds()
		);

		expect(partId).toBe('id5');
		expect(operations).toEqual([
			{
				collection: 'attachments',
				action: 'create',
				body: {
					id: 'id1',
					name: 'Sheet',
					url: 'https://example.com/a.pdf',
					kind: 'datasheet',
					description: ''
				}
			},
			{
				collection: 'ratings',
				action: 'create',
				body: { id: 'id2', key: 'Power', value: '0.25W' }
			},
			{
				collection: 'distributorParts',
				action: 'create',
				body: { id: 'id3', distributor: 'dist1', distributorNumber: '123' }
			},
			{ collection: 'tags', action: 'create', body: { id: 'id4', name: 'SMD' } },
			{
				collection: 'parts',
				action: 'create',
				body: expect.objectContaining({
					id: 'id5',
					valueRaw: '10k',
					ratings: ['id2'],
					distributorParts: ['id3'],
					tags: ['tagresistor0001', 'id4'],
					attachments: ['id1'],
					datasheet: 'id1'
				})
			}
		]);
		const partBody = operations[4].action === 'create' ? operations[4].body : {};
		expect(partBody).not.toHaveProperty('created');
		expect(partBody).not.toHaveProperty('updated');
	});

	it('updates existing rows and deletes the ones the part no longer references', () => {
		const previous = part({
			id: 'part1',
			ratings: ['rating1', 'rating2'],
			distributorParts: ['dp1'],
			datasheet: 'ds1'
		});
		const { operations } = planPartSave(
			input({
				part: part({ id: 'part1', version: 2 }),
				previous,
				ratings: [{ id: 'rating1', key: 'Power', value: '1W' }],
				attachments: [attachment({ id: 'ds1', url: 'https://example.com/a.pdf' })],
				primaryDatasheetId: 'ds1'
			}),
			sequentialIds()
		);

		expect(operations.map((op) => [op.collection, op.action, 'id' in op ? op.id : ''])).toEqual([
			['attachments', 'update', 'ds1'],
			['ratings', 'update', 'rating1'],
			['parts', 'update', 'part1'],
			['ratings', 'delete', 'rating2'],
			['distributorParts', 'delete', 'dp1']
		]);
		expect(operations[2]).toMatchObject({
			body: {
				ratings: ['rating1'],
				distributorParts: [],
				tags: [],
				attachments: ['ds1'],
				datasheet: 'ds1',
				version: 2
			}
		});
	});

	it('does not resend existing rows that did not change', () => {
		const saved = {
			ratings: [{ id: 'rating1', key: 'Power', value: '1W', created: now, updated: now }],
			distributorParts: [
				{ id: 'dp1', distributor: 'dist1', distributorNumber: '123', created: now, updated: now }
			],
			attachments: [savedAttachment({ id: 'ds1', url: 'https://example.com/a.pdf' })]
		};
		const { operations } = planPartSave(
			input({
				part: part({ id: 'part1', version: 2 }),
				previous: part({ id: 'part1', ratings: ['rating1'], distributorParts: ['dp1'] }),
				ratings: [{ id: 'rating1', key: 'Power ', value: '2W' }],
				distributorParts: [{ id: 'dp1', distributor: 'dist1', distributorNumber: ' 123' }],
				attachments: [attachment({ id: 'ds1', url: 'https://example.com/a.pdf' })],
				primaryDatasheetId: 'ds1',
				saved
			}),
			sequentialIds()
		);

		expect(operations.map((op) => [op.collection, op.action, 'id' in op ? op.id : ''])).toEqual([
			['ratings', 'update', 'rating1'],
			['parts', 'update', 'part1']
		]);
		expect(operations[1]).toMatchObject({
			body: {
				ratings: ['rating1'],
				distributorParts: ['dp1'],
				attachments: ['ds1'],
				datasheet: 'ds1'
			}
		});
	});

	it('skips empty rows and clears optional fields with null', () => {
		const { operations } = planPartSave(
			input({
				part: part({ manufacturer: undefined }),
				ratings: [
					{ id: 'new-1', key: ' ', value: ' ' },
					{ id: 'new-2', key: 'Power', value: '' }
				],
				distributorParts: [{ id: 'new-3', distributor: '', distributorNumber: '' }],
				tags: [{ id: 'new-4', name: '  ' }],
				attachments: [attachment({ id: 'new-5', name: 'typed only' })],
				primaryDatasheetId: 'new-5'
			}),
			sequentialIds()
		);

		expect(operations).toHaveLength(1);
		expect(operations[0]).toMatchObject({
			collection: 'parts',
			action: 'create',
			body: {
				ratings: [],
				distributorParts: [],
				tags: [],
				attachments: [],
				datasheet: '',
				manufacturer: null
			}
		});
	});

	describe('attachments', () => {
		const saved = {
			ratings: [],
			distributorParts: [],
			attachments: [
				savedAttachment({ id: 'att1' }),
				savedAttachment({ id: 'att2', name: 'Manual', kind: 'reference-manual' })
			]
		};

		it('links attachments in order without resending unchanged ones', () => {
			const { operations } = planPartSave(
				input({
					attachments: [
						attachment({ id: 'att2', name: 'Manual', kind: 'reference-manual' }),
						attachment({ id: 'att1' })
					],
					primaryDatasheetId: 'att1',
					saved
				}),
				sequentialIds()
			);

			expect(operations).toHaveLength(1);
			expect(operations[0]).toMatchObject({
				collection: 'parts',
				body: { attachments: ['att2', 'att1'], datasheet: 'att1' }
			});
		});

		it('updates the metadata of an existing attachment only when it changed', () => {
			const { operations } = planPartSave(
				input({
					attachments: [
						attachment({ id: 'att1', name: ' Sheet v2 ', description: ' Rev B ' }),
						attachment({ id: 'att2', name: 'Manual', kind: 'app-note' })
					],
					saved
				}),
				sequentialIds()
			);

			expect(operations.slice(0, 2)).toEqual([
				{
					collection: 'attachments',
					action: 'update',
					id: 'att1',
					body: { name: 'Sheet v2', url: '', kind: 'datasheet', description: 'Rev B' }
				},
				{
					collection: 'attachments',
					action: 'update',
					id: 'att2',
					body: { name: 'Manual', url: '', kind: 'app-note', description: '' }
				}
			]);
		});

		it('never deletes attachments the part no longer links', () => {
			const { operations } = planPartSave(
				input({
					part: part({ id: 'part1' }),
					previous: part({ id: 'part1', attachments: ['att1', 'att2'], datasheet: 'att1' }),
					attachments: [attachment({ id: 'att2', name: 'Manual', kind: 'reference-manual' })],
					primaryDatasheetId: 'att1',
					saved
				}),
				sequentialIds()
			);

			expect(operations.some((op) => op.action === 'delete')).toBe(false);
			expect(operations).toEqual([
				expect.objectContaining({
					collection: 'parts',
					action: 'update',
					body: expect.objectContaining({ attachments: ['att2'], datasheet: '' })
				})
			]);
		});

		it('clears the primary datasheet when it is not linked', () => {
			const { operations } = planPartSave(
				input({
					attachments: [attachment({ id: 'att1' })],
					primaryDatasheetId: 'elsewhere',
					saved
				}),
				sequentialIds()
			);

			expect(operations.at(-1)).toMatchObject({ body: { attachments: ['att1'], datasheet: '' } });
		});

		it('skips files that are not uploaded yet and duplicate links', () => {
			const file = new File(['%PDF'], 'sheet.pdf', { type: 'application/pdf' });
			const { operations } = planPartSave(
				input({
					attachments: [
						attachment({ id: 'new-1', file, url: 'https://example.com/a.pdf' }),
						attachment({ id: 'att1' }),
						attachment({ id: 'att1' })
					],
					primaryDatasheetId: 'new-1',
					saved
				}),
				sequentialIds()
			);

			expect(operations).toHaveLength(1);
			expect(operations[0]).toMatchObject({ body: { attachments: ['att1'], datasheet: '' } });
			expect(JSON.stringify(operations)).not.toContain('"file"');
		});
	});

	it('collapses duplicate tag names into one tag', () => {
		const { operations } = planPartSave(
			input({
				tags: [
					{ id: 'new-1', name: 'SMD' },
					{ id: 'new-2', name: 'smd ' },
					{ id: 'tagresistor0001', name: 'Resistor' },
					{ id: 'new-3', name: 'RESISTOR' }
				]
			}),
			sequentialIds()
		);

		expect(operations.filter((op) => op.collection === 'tags')).toEqual([
			{ collection: 'tags', action: 'create', body: { id: 'id1', name: 'SMD' } }
		]);
		expect(operations.at(-1)).toMatchObject({ body: { tags: ['id1', 'tagresistor0001'] } });
	});
});

describe('savePart', () => {
	beforeEach(() => {
		requests.length = 0;
		send.mockReset();
	});

	it('sends all operations in one batch and returns the saved part', async () => {
		const saved = part({ id: 'part1' });
		send.mockResolvedValueOnce([
			{ status: 200, body: { id: 'rating1' } },
			{ status: 200, body: saved },
			{ status: 204, body: null }
		]);

		const result = await savePart(
			input({
				part: part({ id: 'part1' }),
				previous: part({ id: 'part1', ratings: ['rating1', 'rating2'] }),
				ratings: [{ id: 'rating1', key: 'Power', value: '1W' }]
			})
		);

		expect(send).toHaveBeenCalledTimes(1);
		expect(requests.map((request) => request.slice(0, 3))).toEqual([
			['ratings', 'update', 'rating1'],
			['parts', 'update', 'part1'],
			['ratings', 'delete', 'rating2']
		]);
		expect(result).toBe(saved);
	});

	it('throws when the batch fails', async () => {
		send.mockRejectedValueOnce(new Error('batch failed'));
		await expect(savePart(input())).rejects.toThrow('batch failed');
	});

	it('uploads new files first, then links them in the batch', async () => {
		upload.mockReset();
		const file = new File(['%PDF'], 'sheet.pdf', { type: 'application/pdf' });
		const draft = attachment({ id: 'new-1', name: 'Sheet', file });
		const progress = vi.fn();
		upload.mockImplementationOnce(async (_draft, onProgress: (fraction: number) => void) => {
			onProgress(0.5);
			return savedAttachment({ id: 'uploaded1' });
		});
		send.mockResolvedValueOnce([{ status: 200, body: part({ id: 'part1' }) }]);

		await savePart(
			input({
				part: part({ id: 'part1' }),
				attachments: [draft],
				primaryDatasheetId: 'new-1',
				onUploadProgress: progress
			})
		);

		expect(upload).toHaveBeenCalledTimes(1);
		expect(progress).toHaveBeenCalledWith(draft, 0.5);
		expect(draft.id).toBe('uploaded1');
		// The uploaded record is up to date, so only the part is sent.
		expect(requests).toEqual([
			[
				'parts',
				'update',
				'part1',
				expect.objectContaining({ attachments: ['uploaded1'], datasheet: 'uploaded1' })
			]
		]);
	});

	it('does not upload again when retrying after a failed batch', async () => {
		upload.mockReset();
		const file = new File(['%PDF'], 'sheet.pdf', { type: 'application/pdf' });
		const draft = attachment({ id: 'new-1', file });
		upload.mockResolvedValueOnce(savedAttachment({ id: 'uploaded1' }));
		send.mockRejectedValueOnce(new Error('batch failed'));
		// Like the dialog: the primary datasheet is whatever id the draft has at submit time.
		const save = () => savePart(input({ attachments: [draft], primaryDatasheetId: draft.id }));

		await expect(save()).rejects.toThrow('batch failed');
		send.mockResolvedValueOnce([
			{ status: 200, body: savedAttachment({ id: 'uploaded1' }) },
			{ status: 200, body: part({ id: 'part1' }) }
		]);
		requests.length = 0;
		await save();

		expect(upload).toHaveBeenCalledTimes(1);
		expect(requests.map((request) => request.slice(0, 2))).toEqual([
			['attachments', 'update'],
			['parts', 'create']
		]);
		expect(requests[1][2]).toMatchObject({ attachments: ['uploaded1'], datasheet: 'uploaded1' });
	});

	it('does not send the batch when an upload fails', async () => {
		upload.mockReset();
		upload.mockRejectedValueOnce(new Error('upload failed'));
		const file = new File(['x'], 'model.step');
		await expect(
			savePart(input({ attachments: [attachment({ id: 'new-1', kind: '3d-model', file })] }))
		).rejects.toThrow('upload failed');
		expect(send).not.toHaveBeenCalled();
	});
});
