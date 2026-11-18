import { z } from 'zod';
import type { PartsStatusOptions } from '#lib/data/pocketbase-types.ts';

export const statuses: PartsStatusOptions[] = ['Active', 'Not for New Design', 'Deprecate'];
export const schema = z
	.object({
		valueMode: z.enum(['text', 'numeric']),
		valueRaw: z.string(),
		numericValue: z.string(),
		unit: z.string(),
		description: z.string(),
		designator: z.string().min(1, 'Select a designator.'),
		category: z.string().min(1, 'Select a category.'),
		symbol: z.string().min(1, 'Select a symbol.'),
		footprint: z.string().min(1, 'Select a footprint.'),
		manufacturer: z.string(),
		manufacturerNumber: z.string(),
		status: z.enum(statuses)
	})
	.superRefine((data, ctx) => {
		if (data.valueMode === 'text' && !data.valueRaw.trim()) {
			ctx.addIssue({ code: 'custom', path: ['valueRaw'], message: 'Enter a text value.' });
		}
		if (data.valueMode === 'numeric') {
			if (!Number.isFinite(Number(data.numericValue))) {
				ctx.addIssue({
					code: 'custom',
					path: ['numericValue'],
					message: 'Enter a valid number.'
				});
			}
			if (!data.unit) {
				ctx.addIssue({ code: 'custom', path: ['unit'], message: 'Select a unit.' });
			}
		}
	});

type PartFormData = z.infer<typeof schema>;
export type PartFormField = keyof PartFormData;
