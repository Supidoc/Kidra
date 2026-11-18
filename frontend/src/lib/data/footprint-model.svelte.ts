import { untrack } from 'svelte';
import { errorMessage } from './errors.ts';
import {
	fetchFootprintModel,
	getFootprintModelInfo,
	type FootprintModelInfo
} from './kicad-previews.ts';

type Fetchers = {
	getInfo: typeof getFootprintModelInfo;
	fetchModel: typeof fetchFootprintModel;
};

/**
 * The 3D model of one footprint at a time, for a preview pane.
 *
 * - `info` is checked whenever the footprint changes (a small JSON request).
 * - The model itself is only downloaded while `active()` is true and `info.exists`; once
 *   loaded it stays available as `url` (an object URL) until the footprint changes.
 * - Changing the footprint aborts pending requests and ignores their late answers. The object
 *   URL is revoked when the footprint changes or the owning component is destroyed.
 *
 * Construct it during component initialisation: the constructor registers `$effect`s that
 * call `setFootprint`, `activate` and `dispose`. Those methods hold the logic (and are what
 * the unit tests drive).
 */
export class FootprintModelState {
	/** `/info` of the current footprint; null while loading or when no footprint is set. */
	info = $state<FootprintModelInfo | null>(null);
	/** Object URL of the downloaded model, or ''. */
	url = $state('');
	loading = $state(false);
	error = $state('');

	#fetchers: Fetchers;
	#id = '';
	#controller = new AbortController();
	#requested = false;

	constructor(
		getId: () => string,
		active: () => boolean,
		fetchers: Fetchers = { getInfo: getFootprintModelInfo, fetchModel: fetchFootprintModel }
	) {
		this.#fetchers = fetchers;
		$effect(() => {
			const id = getId();
			untrack(() => this.setFootprint(id));
		});
		$effect(() => {
			if (active() && this.info?.exists) untrack(() => this.activate());
		});
		$effect(() => () => this.dispose());
	}

	/** Switches to another footprint ('' for none); does nothing when it is the current one. */
	setFootprint(id: string) {
		if (id === this.#id) return;
		this.#reset();
		this.#id = id;
		if (!id) return;
		const controller = this.#controller;
		this.#fetchers
			.getInfo(id, controller.signal)
			.then((info) => {
				if (!controller.signal.aborted) this.info = info;
			})
			.catch((error: unknown) => {
				if (controller.signal.aborted) return;
				this.info = { exists: false, model3d: '' };
				this.error = errorMessage(error);
			});
	}

	/** Downloads the model when the footprint has one and it is not loaded or loading yet. */
	activate() {
		if (!this.#id || !this.info?.exists || this.#requested) return;
		this.#requested = true;
		this.loading = true;
		this.error = '';
		const controller = this.#controller;
		this.#fetchers
			.fetchModel(this.#id, controller.signal)
			.then((blob) => {
				if (controller.signal.aborted) return;
				this.url = URL.createObjectURL(blob);
			})
			.catch((error: unknown) => {
				if (controller.signal.aborted) return;
				this.error = errorMessage(error);
				// Allow another try on the next activation.
				this.#requested = false;
			})
			.finally(() => {
				if (!controller.signal.aborted) this.loading = false;
			});
	}

	/** Aborts pending requests and revokes the object URL. */
	dispose() {
		this.#reset();
		this.#id = '';
	}

	#reset() {
		this.#controller.abort();
		this.#controller = new AbortController();
		if (this.url) URL.revokeObjectURL(this.url);
		this.#requested = false;
		this.info = null;
		this.url = '';
		this.loading = false;
		this.error = '';
	}
}
