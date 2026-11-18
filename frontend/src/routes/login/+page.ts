import { redirect } from '@sveltejs/kit';
import { auth } from '#lib/data/auth.svelte.ts';

export function load() {
	if (auth.isValid) redirect(307, '/app/master-data');
}
