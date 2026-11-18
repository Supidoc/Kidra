import type { ComboboxGroup, ComboboxOption } from '#lib/components/combobox/index.js';
import { createCollection } from '#lib/data/collection.svelte.ts';
import type {
	AttachmentsRecord,
	CategoriesRecord,
	DesignatorsRecord,
	DistributorPartsRecord,
	DistributorsRecord,
	FootprintLibrariesRecord,
	FootprintsRecord,
	ManufacturersRecord,
	RatingsRecord,
	SymbolsRecord,
	SymbolLibrariesRecord,
	TagsRecord,
	UnitSetsRecord,
	UnitsRecord
} from '#lib/data/pocketbase-types.ts';
import { statuses } from './part-schema.ts';
import type { DistributorExpand, DistributorPartsDraft } from './types.ts';

export type PartLookups = {
	categories: CategoriesRecord[];
	designators: DesignatorsRecord[];
	footprintLibraries: FootprintLibrariesRecord[];
	footprints: FootprintsRecord[];
	manufacturers: ManufacturersRecord[];
	symbols: SymbolsRecord[];
	symbolLibraries: SymbolLibrariesRecord[];
	unitSets: UnitSetsRecord[];
	units: UnitsRecord[];
	ratings: RatingsRecord[];
	distributors: DistributorsRecord[];
	distributorParts: (DistributorPartsRecord & DistributorExpand)[];
	attachments: AttachmentsRecord[];
	tags: TagsRecord[];
};

/**
 * Creates the lookup collections of the part dialog and starts loading them.
 * `lookups` reads the collections reactively; `ready` turns true once every load has
 * finished (each failed load reports itself). `reload` reloads some or all of them.
 */
export function loadPartLookups() {
	const collections = {
		categories: createCollection<CategoriesRecord>('categories'),
		designators: createCollection<DesignatorsRecord>('designators'),
		footprintLibraries: createCollection<FootprintLibrariesRecord>('footprintLibraries'),
		footprints: createCollection<FootprintsRecord>('footprints'),
		manufacturers: createCollection<ManufacturersRecord>('manufacturers'),
		symbols: createCollection<SymbolsRecord>('symbols'),
		symbolLibraries: createCollection<SymbolLibrariesRecord>('symbolLibraries'),
		unitSets: createCollection<UnitSetsRecord>('unitSets'),
		units: createCollection<UnitsRecord>('units'),
		ratings: createCollection<RatingsRecord>('ratings'),
		distributors: createCollection<DistributorsRecord>('distributors'),
		distributorParts: createCollection<DistributorPartsRecord & DistributorExpand>(
			'distributorParts',
			{ listOptions: { expand: 'distributor' } }
		),
		attachments: createCollection<AttachmentsRecord>('attachments', {
			listOptions: { sort: 'name' }
		}),
		tags: createCollection<TagsRecord>('tags')
	} satisfies { [K in keyof PartLookups]: { readonly data: PartLookups[K] } };
	type LookupName = keyof typeof collections;
	const names = Object.keys(collections) as LookupName[];

	const lookups = {} as PartLookups;
	for (const name of names) {
		Object.defineProperty(lookups, name, { enumerable: true, get: () => collections[name].data });
	}

	/** Resolves to whether every load succeeded. */
	async function reload(only: LookupName[] = names) {
		const results = await Promise.all(only.map((name) => collections[name].load()));
		return !results.includes(false);
	}

	let ready = $state(false);
	reload().then(() => {
		ready = true;
	});

	return {
		lookups,
		get ready() {
			return ready;
		},
		reload
	};
}

function options<T extends { id: string }>(
	items: T[],
	label: (item: T) => string
): ComboboxOption[] {
	return items.map((item) => ({ id: item.id, label: label(item) }));
}

function unitLabel(unit: UnitsRecord) {
	return unit.symbolFancy ? `${unit.name} (${unit.symbolFancy})` : unit.name;
}

const statusOptions = statuses.map((option) => ({ value: option, label: option }));

export function display(items: ComboboxOption[], id: string) {
	return items.find((item) => item.id === id)?.label ?? id;
}

export function displayWithLibrary(
	items: Array<{ id: string; name: string; library?: string }>,
	id: string,
	libraries: Array<{ id: string; name: string }>
) {
	const item = items.find((option) => option.id === id);
	if (!item) return id;
	const library = libraries.find((option) => option.id === item.library)?.name ?? item.library;
	return library ? `${library}: ${item.name}` : item.name;
}

export function distributorName(distributors: DistributorsRecord[], id: string) {
	return distributors.find((distributor) => distributor.id === id)?.name ?? id;
}

/** Keeps `expand.distributor` in sync with the selected id (used for table search/sort). */
export function withDistributorExpand(
	distributors: DistributorsRecord[],
	row: DistributorPartsDraft
): DistributorPartsDraft {
	if (row.expand?.distributor?.id === row.distributor) return row;
	const distributor = distributors.find((item) => item.id === row.distributor);
	return { ...row, expand: distributor ? { distributor } : undefined };
}

/** Reactive combobox/select options derived from the lookup collections. */
export function createLookupOptions(getLookups: () => PartLookups) {
	const lookups = $derived(getLookups());

	const categoryOptions = $derived(options(lookups.categories, (item) => item.name));
	const designatorOptions = $derived(
		options(lookups.designators, (item) => item.designatorString || item.name)
	);
	const distributorOptions = $derived(options(lookups.distributors, (item) => item.name));
	const manufacturerOptions = $derived(options(lookups.manufacturers, (item) => item.name));
	const footprintsByLibrary = $derived(
		lookups.footprintLibraries.map((library): ComboboxGroup => ({
			id: library.id,
			label: library.name,
			options: lookups.footprints
				.filter((item) => item.library === library.id)
				.map((item) => ({ id: item.id, label: `${library.name}: ${item.name}` }))
		}))
	);
	const symbolsByLibrary = $derived(
		lookups.symbolLibraries.map((library): ComboboxGroup => ({
			id: library.id,
			label: library.name,
			options: lookups.symbols
				.filter((item) => item.library === library.id)
				.map((item) => ({ id: item.id, label: `${library.name}: ${item.name}` }))
		}))
	);
	const unitOptions = $derived(options(lookups.units, unitLabel));
	const unitsBySet = $derived(
		lookups.unitSets.map((set): ComboboxGroup => ({
			id: set.id,
			label: set.name ?? 'Units',
			options: lookups.units
				.filter((item) => item.unitSet === set.id)
				.map((item) => ({ id: item.id, label: unitLabel(item) }))
		}))
	);
	const tagSuggestions = $derived(
		lookups.tags
			.filter((tag) => tag.name?.trim())
			.map((tag) => ({ id: tag.id, name: tag.name ?? '' }))
	);

	return {
		get categoryOptions() {
			return categoryOptions;
		},
		get designatorOptions() {
			return designatorOptions;
		},
		get distributorOptions() {
			return distributorOptions;
		},
		get manufacturerOptions() {
			return manufacturerOptions;
		},
		get unitOptions() {
			return unitOptions;
		},
		get symbolsByLibrary() {
			return symbolsByLibrary;
		},
		get footprintsByLibrary() {
			return footprintsByLibrary;
		},
		get unitsBySet() {
			return unitsBySet;
		},
		get tagSuggestions() {
			return tagSuggestions;
		},
		get statusOptions() {
			return statusOptions;
		}
	};
}

export type LookupOptions = ReturnType<typeof createLookupOptions>;
