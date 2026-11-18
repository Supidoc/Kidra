import type { DistributorPartsDraft as DistributorPartsRow } from '#lib/data/parts.ts';
import type { DistributorsRecord } from '#lib/data/pocketbase-types.ts';

export type { AttachmentDraft, PartDraft, RatingDraft } from '#lib/data/parts.ts';

export type Mode = 'create' | 'edit' | 'view';
export type DistributorExpand = { expand?: { distributor?: DistributorsRecord } };
export type DistributorPartsDraft = DistributorPartsRow & DistributorExpand;
