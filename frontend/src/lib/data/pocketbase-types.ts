/**
* This file was @generated using pocketbase-typegen
*/

import type PocketBase from 'pocketbase'
import type { RecordService } from 'pocketbase'

export const Collections = {
	Authorigins: "_authOrigins",
	Externalauths: "_externalAuths",
	Mfas: "_mfas",
	Otps: "_otps",
	Superusers: "_superusers",
	Attachments: "attachments",
	Categories: "categories",
	Designators: "designators",
	DistributorParts: "distributorParts",
	Distributors: "distributors",
	FootprintLibraries: "footprintLibraries",
	Footprints: "footprints",
	Manufacturers: "manufacturers",
	Parts: "parts",
	Ratings: "ratings",
	SymbolLibraries: "symbolLibraries",
	Symbols: "symbols",
	Tags: "tags",
	TagsPartsCountView: "tagsPartsCountView",
	Units: "units",
	UnitSets: "unitSets",
	Users: "users",
} as const
export type Collections = typeof Collections[keyof typeof Collections]

// Alias types for improved usability
export type IsoDateString = string
export type IsoAutoDateString = string & { readonly autodate: unique symbol }
export type RecordIdString = string
export type FileNameString = string & { readonly filename: unique symbol }
export type HTMLString = string

type ExpandType<T> = unknown extends T
	? T extends unknown
		? { expand?: unknown }
		: { expand: T }
	: { expand: T }

// System fields
export type BaseSystemFields<T = unknown> = {
	id: RecordIdString
	collectionId: string
	collectionName: Collections
} & ExpandType<T>

export type AuthSystemFields<T = unknown> = {
	email: string
	emailVisibility: boolean
	username: string
	verified: boolean
} & BaseSystemFields<T>

// Record types for each collection

export type AuthoriginsRecord = {
	collectionRef: string
	created: IsoAutoDateString
	fingerprint: string
	id: string
	recordRef: string
	updated: IsoAutoDateString
}

export type ExternalauthsRecord = {
	collectionRef: string
	created: IsoAutoDateString
	id: string
	provider: string
	providerId: string
	recordRef: string
	updated: IsoAutoDateString
}

export type MfasRecord = {
	collectionRef: string
	created: IsoAutoDateString
	id: string
	method: string
	recordRef: string
	updated: IsoAutoDateString
}

export type OtpsRecord = {
	collectionRef: string
	created: IsoAutoDateString
	id: string
	password: string
	recordRef: string
	sentTo?: string
	updated: IsoAutoDateString
}

export type SuperusersRecord = {
	created: IsoAutoDateString
	email: string
	emailVisibility?: boolean
	id: string
	password: string
	tokenKey: string
	updated: IsoAutoDateString
	verified?: boolean
}

export const AttachmentsKindOptions = {
	"datasheet": "datasheet",
	"reference-manual": "reference-manual",
	"app-note": "app-note",
	"3d-model": "3d-model",
	"image": "image",
	"other": "other",
} as const
export type AttachmentsKindOptions = typeof AttachmentsKindOptions[keyof typeof AttachmentsKindOptions]
export type AttachmentsRecord = {
	created: IsoAutoDateString
	description?: string
	file?: FileNameString
	id: string
	kind?: AttachmentsKindOptions
	name?: string
	updated: IsoAutoDateString
	url?: string
}

export type CategoriesRecord = {
	created: IsoAutoDateString
	description?: string
	id: string
	name: string
	updated: IsoAutoDateString
}

export type DesignatorsRecord = {
	created: IsoAutoDateString
	designatorString: string
	id: string
	name: string
	updated: IsoAutoDateString
}

export type DistributorPartsRecord = {
	created: IsoAutoDateString
	distributor: RecordIdString
	distributorNumber: string
	id: string
	updated: IsoAutoDateString
}

export type DistributorsRecord = {
	created: IsoAutoDateString
	description?: string
	id: string
	name: string
	updated: IsoAutoDateString
	website?: string
}

export type FootprintLibrariesRecord = {
	available?: boolean
	created: IsoAutoDateString
	id: string
	name: string
	updated: IsoAutoDateString
}

export type FootprintsRecord = {
	available?: boolean
	created: IsoAutoDateString
	description?: string
	id: string
	library?: RecordIdString
	model3d?: string
	name: string
	padCount?: number
	preview?: FileNameString
	sourceHash?: string
	updated: IsoAutoDateString
}

export type ManufacturersRecord = {
	created: IsoAutoDateString
	description?: string
	id: string
	name: string
	updated: IsoAutoDateString
}

export const PartsStatusOptions = {
	"Active": "Active",
	"Not for New Design": "Not for New Design",
	"Deprecate": "Deprecate",
} as const
export type PartsStatusOptions = typeof PartsStatusOptions[keyof typeof PartsStatusOptions]
export type PartsRecord = {
	attachments?: RecordIdString[]
	category: RecordIdString
	created: IsoAutoDateString
	datasheet?: RecordIdString
	description?: string
	designator: RecordIdString
	distributorParts?: RecordIdString[]
	excludeFromBoard?: boolean
	excludeFromBom?: boolean
	footprint: RecordIdString
	id: string
	isNumeric?: boolean
	manufacturer?: RecordIdString
	manufacturerNumber?: string
	ratings?: RecordIdString[]
	status: PartsStatusOptions
	symbol: RecordIdString
	tags?: RecordIdString[]
	unit?: RecordIdString
	updated: IsoAutoDateString
	valueRaw: string
	valueSi?: number
	version: number
}

export type RatingsRecord = {
	created: IsoAutoDateString
	id: string
	key: string
	updated: IsoAutoDateString
	value: string
}

export type SymbolLibrariesRecord = {
	available?: boolean
	created: IsoAutoDateString
	description?: string
	id: string
	name: string
	updated: IsoAutoDateString
}

export type SymbolsRecord = {
	available?: boolean
	created: IsoAutoDateString
	description?: string
	id: string
	library: RecordIdString
	name: string
	pinCount?: number
	preview?: FileNameString
	sourceHash?: string
	updated: IsoAutoDateString
}

export type TagsRecord = {
	created: IsoAutoDateString
	id: string
	name?: string
	updated: IsoAutoDateString
}

export type TagsPartsCountViewRecord = {
	created: IsoAutoDateString
	id: string
	name?: string
	partCount?: number
	updated: IsoAutoDateString
}

export type UnitsRecord = {
	created: IsoAutoDateString
	factor: number
	id: string
	name: string
	symbolFancy: string
	symbolLetter: string
	unitSet: RecordIdString
	updated: IsoAutoDateString
}

export type UnitSetsRecord = {
	created: IsoAutoDateString
	id: string
	name?: string
	updated: IsoAutoDateString
}

export const UsersRolesOptions = {
	"admin": "admin",
	"user": "user",
} as const
export type UsersRolesOptions = typeof UsersRolesOptions[keyof typeof UsersRolesOptions]
export type UsersRecord = {
	avatar?: FileNameString
	created: IsoAutoDateString
	email: string
	emailVisibility?: boolean
	id: string
	name?: string
	password: string
	roles?: UsersRolesOptions[]
	tokenKey: string
	updated: IsoAutoDateString
	verified?: boolean
}

// Response types include system fields and match responses from the PocketBase API
export type AuthoriginsResponse<Texpand = unknown> = Required<AuthoriginsRecord> & BaseSystemFields<Texpand>
export type ExternalauthsResponse<Texpand = unknown> = Required<ExternalauthsRecord> & BaseSystemFields<Texpand>
export type MfasResponse<Texpand = unknown> = Required<MfasRecord> & BaseSystemFields<Texpand>
export type OtpsResponse<Texpand = unknown> = Required<OtpsRecord> & BaseSystemFields<Texpand>
export type SuperusersResponse<Texpand = unknown> = Required<SuperusersRecord> & AuthSystemFields<Texpand>
export type AttachmentsResponse<Texpand = unknown> = Required<AttachmentsRecord> & BaseSystemFields<Texpand>
export type CategoriesResponse<Texpand = unknown> = Required<CategoriesRecord> & BaseSystemFields<Texpand>
export type DesignatorsResponse<Texpand = unknown> = Required<DesignatorsRecord> & BaseSystemFields<Texpand>
export type DistributorPartsResponse<Texpand = unknown> = Required<DistributorPartsRecord> & BaseSystemFields<Texpand>
export type DistributorsResponse<Texpand = unknown> = Required<DistributorsRecord> & BaseSystemFields<Texpand>
export type FootprintLibrariesResponse<Texpand = unknown> = Required<FootprintLibrariesRecord> & BaseSystemFields<Texpand>
export type FootprintsResponse<Texpand = unknown> = Required<FootprintsRecord> & BaseSystemFields<Texpand>
export type ManufacturersResponse<Texpand = unknown> = Required<ManufacturersRecord> & BaseSystemFields<Texpand>
export type PartsResponse<Texpand = unknown> = Required<PartsRecord> & BaseSystemFields<Texpand>
export type RatingsResponse<Texpand = unknown> = Required<RatingsRecord> & BaseSystemFields<Texpand>
export type SymbolLibrariesResponse<Texpand = unknown> = Required<SymbolLibrariesRecord> & BaseSystemFields<Texpand>
export type SymbolsResponse<Texpand = unknown> = Required<SymbolsRecord> & BaseSystemFields<Texpand>
export type TagsResponse<Texpand = unknown> = Required<TagsRecord> & BaseSystemFields<Texpand>
export type TagsPartsCountViewResponse<Texpand = unknown> = Required<TagsPartsCountViewRecord> & BaseSystemFields<Texpand>
export type UnitsResponse<Texpand = unknown> = Required<UnitsRecord> & BaseSystemFields<Texpand>
export type UnitSetsResponse<Texpand = unknown> = Required<UnitSetsRecord> & BaseSystemFields<Texpand>
export type UsersResponse<Texpand = unknown> = Required<UsersRecord> & AuthSystemFields<Texpand>

// Types containing all Records and Responses, useful for creating typing helper functions

export type CollectionRecords = {
	_authOrigins: AuthoriginsRecord
	_externalAuths: ExternalauthsRecord
	_mfas: MfasRecord
	_otps: OtpsRecord
	_superusers: SuperusersRecord
	attachments: AttachmentsRecord
	categories: CategoriesRecord
	designators: DesignatorsRecord
	distributorParts: DistributorPartsRecord
	distributors: DistributorsRecord
	footprintLibraries: FootprintLibrariesRecord
	footprints: FootprintsRecord
	manufacturers: ManufacturersRecord
	parts: PartsRecord
	ratings: RatingsRecord
	symbolLibraries: SymbolLibrariesRecord
	symbols: SymbolsRecord
	tags: TagsRecord
	tagsPartsCountView: TagsPartsCountViewRecord
	units: UnitsRecord
	unitSets: UnitSetsRecord
	users: UsersRecord
}

export type CollectionResponses = {
	_authOrigins: AuthoriginsResponse
	_externalAuths: ExternalauthsResponse
	_mfas: MfasResponse
	_otps: OtpsResponse
	_superusers: SuperusersResponse
	attachments: AttachmentsResponse
	categories: CategoriesResponse
	designators: DesignatorsResponse
	distributorParts: DistributorPartsResponse
	distributors: DistributorsResponse
	footprintLibraries: FootprintLibrariesResponse
	footprints: FootprintsResponse
	manufacturers: ManufacturersResponse
	parts: PartsResponse
	ratings: RatingsResponse
	symbolLibraries: SymbolLibrariesResponse
	symbols: SymbolsResponse
	tags: TagsResponse
	tagsPartsCountView: TagsPartsCountViewResponse
	units: UnitsResponse
	unitSets: UnitSetsResponse
	users: UsersResponse
}

// Utility types for create/update operations

type ProcessCreateAndUpdateFields<T> = Omit<{
	// Omit AutoDate fields
	[K in keyof T as Extract<T[K], IsoAutoDateString> extends never ? K : never]: 
		// Convert FileNameString to File
		T[K] extends infer U ? 
			U extends (FileNameString | FileNameString[]) ? 
				U extends any[] ? File[] : File 
			: U
		: never
}, 'id'>

// Create type for Auth collections
export type CreateAuth<T> = {
	id?: RecordIdString
	email: string
	emailVisibility?: boolean
	password: string
	passwordConfirm: string
	verified?: boolean
} & ProcessCreateAndUpdateFields<T>

// Create type for Base collections
export type CreateBase<T> = {
	id?: RecordIdString
} & ProcessCreateAndUpdateFields<T>

// Update type for Auth collections
export type UpdateAuth<T> = Partial<
	Omit<ProcessCreateAndUpdateFields<T>, keyof AuthSystemFields>
> & {
	email?: string
	emailVisibility?: boolean
	oldPassword?: string
	password?: string
	passwordConfirm?: string
	verified?: boolean
}

// Update type for Base collections
export type UpdateBase<T> = Partial<
	Omit<ProcessCreateAndUpdateFields<T>, keyof BaseSystemFields>
>

// Get the correct create type for any collection
export type Create<T extends keyof CollectionResponses> =
	CollectionResponses[T] extends AuthSystemFields
		? CreateAuth<CollectionRecords[T]>
		: CreateBase<CollectionRecords[T]>

// Get the correct update type for any collection
export type Update<T extends keyof CollectionResponses> =
	CollectionResponses[T] extends AuthSystemFields
		? UpdateAuth<CollectionRecords[T]>
		: UpdateBase<CollectionRecords[T]>

// Type for usage with type asserted PocketBase instance
// https://github.com/pocketbase/js-sdk#specify-typescript-definitions

export type TypedPocketBase = {
	collection<T extends keyof CollectionResponses>(
		idOrName: T
	): RecordService<CollectionResponses[T]>
} & PocketBase
