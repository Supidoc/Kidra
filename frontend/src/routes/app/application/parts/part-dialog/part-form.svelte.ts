import { SvelteSet } from 'svelte/reactivity';
import type { TagDraft } from '#lib/components/tag-input/index.js';
import type {
	PartsRecord,
	PartsStatusOptions,
	RatingsRecord,
	TagsRecord
} from '#lib/data/pocketbase-types.ts';
import { EditableRows } from './editable-rows.svelte.ts';
import {
	createLookupOptions,
	display,
	distributorName,
	withDistributorExpand,
	type LookupOptions,
	type PartLookups
} from './part-lookups.svelte.ts';
import { schema, type PartFormField } from './part-schema.ts';
import type { DistributorPartsDraft, RatingDraft } from './types.ts';

/** Fields marked as touched when the whole form is submitted. */
const submitFields: PartFormField[] = [
	'valueRaw',
	'numericValue',
	'unit',
	'designator',
	'category',
	'symbol',
	'footprint'
];

/**
 * Form state of the part dialog (fields, validation, rating and distributor rows).
 * `getLookups` is read lazily, so pass a closure over the component props.
 * Methods must be called on the instance (wrap them in arrow handlers when used as callbacks).
 */
export class PartFormState {
	readonly options: LookupOptions;
	#getLookups: () => PartLookups;

	valueMode = $state<'text' | 'numeric'>('text');
	valueRaw = $state('');
	numericValue = $state('');
	description = $state('');
	designator = $state('');
	category = $state('');
	symbol = $state('');
	footprint = $state('');
	manufacturer = $state('');
	manufacturerNumber = $state('');
	unit = $state('');
	status = $state<PartsStatusOptions>('Active');
	excludeFromBoard = $state(false);
	excludeFromBom = $state(false);
	version = $state('1');
	tags = $state<TagDraft[]>([]);
	errors = $state<Partial<Record<PartFormField, string>>>({});
	readonly touched = new SvelteSet<PartFormField>();
	isSaving = $state(false);

	readonly ratings = new EditableRows<RatingDraft>();
	readonly distributorParts: EditableRows<DistributorPartsDraft>;

	constructor(getLookups: () => PartLookups) {
		this.#getLookups = getLookups;
		this.options = createLookupOptions(getLookups);
		this.distributorParts = new EditableRows<DistributorPartsDraft>({
			normalize: (row) => withDistributorExpand(getLookups().distributors, row)
		});
	}

	/** Loads the form from `part` (or clears it for a new part). Does not touch the attachments. */
	reset(part: PartsRecord | null) {
		const lookups = this.#getLookups();
		this.valueMode = part?.isNumeric ? 'numeric' : 'text';
		this.valueRaw = part?.valueRaw ?? '';
		this.numericValue = part?.valueSi == null ? '' : String(part.valueSi);
		this.description = part?.description ?? '';
		this.designator = part?.designator ?? '';
		this.category = part?.category ?? '';
		this.symbol = part?.symbol ?? '';
		this.footprint = part?.footprint ?? '';
		this.manufacturer = part?.manufacturer ?? '';
		this.manufacturerNumber = part?.manufacturerNumber ?? '';
		this.unit = part?.unit ?? '';
		this.status = part?.status ?? 'Active';
		this.excludeFromBoard = part?.excludeFromBoard ?? false;
		this.excludeFromBom = part?.excludeFromBom ?? false;
		this.version = String(part?.version ?? 1);
		this.ratings.set(
			part?.ratings
				?.map((id) => lookups.ratings.find((rating) => rating.id === id))
				.filter((rating): rating is RatingsRecord => Boolean(rating))
				.map(({ id, key, value }) => ({ id, key, value })) ?? []
		);
		this.distributorParts.set(
			part?.distributorParts
				?.map((id) => lookups.distributorParts.find((distributorPart) => distributorPart.id === id))
				.filter((distributorPart) => distributorPart !== undefined)
				.map(({ id, distributor, distributorNumber, expand }) => ({
					id,
					distributor,
					distributorNumber,
					expand
				}))
				.sort((a, b) =>
					distributorName(lookups.distributors, a.distributor).localeCompare(
						distributorName(lookups.distributors, b.distributor)
					)
				) ?? []
		);
		this.tags =
			part?.tags
				?.map((id) => lookups.tags.find((tag) => tag.id === id))
				.filter((tag): tag is TagsRecord => Boolean(tag))
				.map(({ id, name }) => ({ id, name: name ?? '' })) ?? [];
		this.errors = {};
		this.touched.clear();
	}

	#currentData() {
		return {
			valueMode: this.valueMode,
			valueRaw: this.valueRaw,
			numericValue: this.numericValue,
			unit: this.unit,
			description: this.description,
			designator: this.designator,
			category: this.category,
			symbol: this.symbol,
			footprint: this.footprint,
			manufacturer: this.manufacturer,
			manufacturerNumber: this.manufacturerNumber,
			status: this.status
		};
	}

	/**
	 * Validates the form against the schema. With `fields`, only those fields' errors are
	 * updated. Returns whether the whole form is valid.
	 */
	validate(fields?: PartFormField[]) {
		const result = schema.safeParse(this.#currentData());
		const next: Partial<Record<PartFormField, string>> = {};
		if (!result.success) {
			for (const issue of result.error.issues) {
				const key = issue.path[0] as PartFormField;
				if ((!fields || fields.includes(key)) && !next[key]) next[key] = issue.message;
			}
		}
		const base = { ...this.errors };
		if (fields) {
			for (const key of fields) {
				if (!next[key]) delete base[key];
			}
		}
		this.errors = { ...base, ...next };
		return result.success;
	}

	touch(field: PartFormField) {
		this.touched.add(field);
		this.validate([field]);
	}

	isInvalid(field: PartFormField) {
		return Boolean(this.errors[field] && this.touched.has(field));
	}

	#touchAll() {
		this.touched.clear();
		for (const field of submitFields) this.touched.add(field);
	}

	validateRatings() {
		return this.ratings.validate({
			isEmpty: (row) => !(row.key.trim() || row.value.trim()),
			isComplete: (row) => Boolean(row.key.trim() && row.value.trim()),
			keyOf: (row) => row.key.trim(),
			incompleteMessage: 'Enter both a key and a value, or remove this row.',
			duplicateMessage: 'Each rating key can only be used once per part.'
		});
	}

	validateDistributorParts() {
		return this.distributorParts.validate({
			isEmpty: (row) => !(row.distributor.trim() || row.distributorNumber.trim()),
			isComplete: (row) => Boolean(row.distributor && row.distributorNumber.trim()),
			keyOf: (row) => row.distributor,
			incompleteMessage: 'Select a distributor and enter its part number, or remove this row.',
			duplicateMessage: 'Each distributor can only be used once per part.'
		});
	}

	/** Touches all submit fields and validates the form, then ratings, then distributor parts. */
	validateAll(): boolean {
		this.#touchAll();
		return this.validate() && this.validateRatings() && this.validateDistributorParts();
	}

	/** Builds the part record to save from the current form values. */
	toPart(part: PartsRecord | null): PartsRecord {
		// eslint-disable-next-line svelte/prefer-svelte-reactivity -- one-off timestamp, never mutated
		const now = new Date().toISOString() as PartsRecord['created'];
		return {
			id: part?.id ?? '',
			valueRaw:
				this.valueMode === 'text'
					? this.valueRaw.trim()
					: `${this.numericValue} ${display(this.options.unitOptions, this.unit)}`,
			valueSi: this.valueMode === 'numeric' ? Number(this.numericValue) : undefined,
			isNumeric: this.valueMode === 'numeric',
			description: this.description.trim(),
			designator: this.designator,
			category: this.category,
			symbol: this.symbol,
			footprint: this.footprint,
			manufacturer: this.manufacturer || undefined,
			manufacturerNumber: this.manufacturerNumber.trim(),
			unit: this.valueMode === 'numeric' ? this.unit : undefined,
			status: this.status,
			excludeFromBoard: this.excludeFromBoard,
			excludeFromBom: this.excludeFromBom,
			version: part ? part.version + 1 : 1,
			created: part?.created ?? now,
			updated: now
		};
	}
}
