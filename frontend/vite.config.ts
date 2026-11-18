import tailwindcss from '@tailwindcss/vite';
import adapter from '@sveltejs/adapter-static';
import { sveltekit } from '@sveltejs/kit/vite';
import { copyFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import type { Plugin } from 'vite';
import { defineConfig } from 'vitest/config';

/**
 * Copies occt-import-js (the STEP/IGES importer of online-3d-viewer, ~8 MB of WASM) from
 * node_modules into `static/occt-import-js/`, so 3D previews work offline instead of
 * loading it from a CDN. The copy is git-ignored; see `model-viewer.svelte`.
 */
function occtImportJs(): Plugin {
	return {
		name: 'kidra-occt-import-js',
		buildStart() {
			const require = createRequire(import.meta.url);
			const source = path.dirname(require.resolve('occt-import-js/package.json'));
			const target = path.resolve(import.meta.dirname, 'static/occt-import-js');
			mkdirSync(target, { recursive: true });
			for (const file of ['occt-import-js.js', 'occt-import-js.wasm', 'occt-import-js-worker.js']) {
				copyFileSync(path.join(source, 'dist', file), path.join(target, file));
			}
		}
	};
}

export default defineConfig({
	plugins: [
		occtImportJs(),
		tailwindcss(),
		sveltekit({
			compilerOptions: {
				// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			},
			// Single-page app embedded into / served by the Go backend from backend/ui/dist.
			adapter: adapter({
				pages: '../backend/ui/dist',
				assets: '../backend/ui/dist',
				fallback: 'index.html',
				precompress: false,
				strict: true
			})
		})
	],
	test: {
		include: ['src/**/*.test.ts']
	}
});
