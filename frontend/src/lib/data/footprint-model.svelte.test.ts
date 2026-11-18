import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FootprintModelInfo } from './kicad-previews.ts';

vi.mock('#lib/data/client.ts', () => ({ pb: {}, apiUrl: (path: string) => path }));

const { FootprintModelState } = await import('./footprint-model.svelte.ts');

type GetInfo = (id: string, signal?: AbortSignal) => Promise<FootprintModelInfo>;
type FetchModel = (id: string, signal?: AbortSignal) => Promise<Blob>;

function deferred<T>() {
	let resolve!: (value: T) => void;
	const promise = new Promise<T>((res) => {
		resolve = res;
	});
	return { promise, resolve };
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

const exists = (filename: string): FootprintModelInfo => ({
	exists: true,
	model3d: `\${KICAD9_3DMODEL_DIR}/${filename}`,
	filename,
	format: 'step'
});

// Tests drive the methods the constructor's effects call (effects do not run in unit tests).
function create(getInfo: GetInfo, fetchModel: FetchModel) {
	return new FootprintModelState(
		() => '',
		() => false,
		{ getInfo, fetchModel }
	);
}

describe('FootprintModelState', () => {
	let created: string[];
	let revoked: string[];

	beforeEach(() => {
		created = [];
		revoked = [];
		let next = 0;
		vi.spyOn(URL, 'createObjectURL').mockImplementation(() => {
			const url = `blob:${++next}`;
			created.push(url);
			return url;
		});
		vi.spyOn(URL, 'revokeObjectURL').mockImplementation((url) => {
			revoked.push(url);
		});
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('checks the info on footprint change but downloads only on activate', async () => {
		const getInfo = vi.fn<GetInfo>(async () => exists('a.step'));
		const fetchModel = vi.fn<FetchModel>(async () => new Blob(['x']));
		const model = create(getInfo, fetchModel);

		model.setFootprint('a');
		await settle();
		expect(getInfo).toHaveBeenCalledWith('a', expect.any(AbortSignal));
		expect(model.info?.filename).toBe('a.step');
		expect(fetchModel).not.toHaveBeenCalled();

		model.activate();
		expect(model.loading).toBe(true);
		await settle();
		expect(model.url).toBe('blob:1');
		expect(model.loading).toBe(false);

		// Activating again reuses the downloaded model; the same footprint is not re-checked.
		model.activate();
		model.setFootprint('a');
		expect(fetchModel).toHaveBeenCalledTimes(1);
		expect(getInfo).toHaveBeenCalledTimes(1);
		expect(model.url).toBe('blob:1');
	});

	it('does not download before the info arrived or when there is no model', async () => {
		const fetchModel = vi.fn<FetchModel>(async () => new Blob(['x']));
		const model = create(async () => ({ exists: false, model3d: '' }), fetchModel);
		model.setFootprint('a');
		model.activate(); // info still pending
		await settle();
		model.activate(); // info says there is none
		expect(model.info?.exists).toBe(false);
		expect(fetchModel).not.toHaveBeenCalled();
		expect(model.url).toBe('');
	});

	it('revokes the object URL when the footprint changes and on dispose', async () => {
		const model = create(
			async (id) => exists(`${id}.step`),
			async () => new Blob(['x'])
		);
		model.setFootprint('a');
		await settle();
		model.activate();
		await settle();
		expect(model.url).toBe('blob:1');

		model.setFootprint('b');
		expect(revoked).toEqual(['blob:1']);
		expect(model.url).toBe('');
		expect(model.info).toBeNull();

		await settle();
		model.activate();
		await settle();
		expect(model.url).toBe('blob:2');

		model.dispose();
		expect(revoked).toEqual(['blob:1', 'blob:2']);
		expect(model.url).toBe('');
	});

	it('ignores stale answers after the footprint changed', async () => {
		const infoA = deferred<FootprintModelInfo>();
		const modelB = deferred<Blob>();
		const signals: AbortSignal[] = [];
		const model = create(
			(id, signal) => {
				signals.push(signal!);
				return id === 'a' ? infoA.promise : Promise.resolve(exists(`${id}.step`));
			},
			() => modelB.promise
		);
		model.setFootprint('a');
		model.setFootprint('b');
		expect(signals[0].aborted).toBe(true);
		expect(signals[1].aborted).toBe(false);

		infoA.resolve(exists('a.step')); // late answer for the old footprint
		await settle();
		expect(model.info?.filename).toBe('b.step');

		model.activate();
		model.setFootprint('c'); // abandon b while its model is downloading
		modelB.resolve(new Blob(['x']));
		await settle();
		expect(created).toEqual([]);
		expect(model.url).toBe('');
		expect(model.info?.filename).toBe('c.step');
	});

	it('reports a failed download and retries on the next activation', async () => {
		const fetchModel = vi
			.fn<FetchModel>()
			.mockRejectedValueOnce(new Error('boom'))
			.mockResolvedValueOnce(new Blob(['x']));
		const model = create(async () => exists('a.step'), fetchModel);
		model.setFootprint('a');
		await settle();
		model.activate();
		await settle();
		expect(model.error).toBe('boom');
		expect(model.loading).toBe(false);

		model.activate();
		expect(model.error).toBe('');
		await settle();
		expect(fetchModel).toHaveBeenCalledTimes(2);
		expect(model.url).toBe('blob:1');
	});

	it('treats a failed info request as no model and shows the error', async () => {
		const model = create(
			async () => {
				throw new Error('offline');
			},
			async () => new Blob()
		);
		model.setFootprint('a');
		await settle();
		expect(model.info).toEqual({ exists: false, model3d: '' });
		expect(model.error).toBe('offline');
	});

	it('does nothing without a footprint', async () => {
		const getInfo = vi.fn<GetInfo>(async () => exists('a.step'));
		const model = create(getInfo, async () => new Blob());
		model.setFootprint('');
		model.activate();
		await settle();
		expect(getInfo).not.toHaveBeenCalled();
		expect(model.info).toBeNull();
	});
});
