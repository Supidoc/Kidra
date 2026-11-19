/** How `AttachmentPreview` shows a source. `svg` is an `<img>` on a solid backdrop (see `background`). */
export type PreviewSourceKind = 'pdf' | 'image' | '3d' | 'text' | 'svg' | 'none';

/** Anything `AttachmentPreview` can show: an attachment, a symbol/footprint SVG, a 3D model, … */
export type PreviewSource = {
	kind: PreviewSourceKind;
	/** URL of the content (http(s), object URL or same-origin path). */
	src: string;
	/**
	 * File name including its extension. The 3D viewer picks its importer by the extension,
	 * and the download link of `none` uses it as the file name.
	 */
	name: string;
	/**
	 * Backdrop of an `svg`: `light` (white, like KiCad's schematic editor, the default) or
	 * `dark` (KiCad's PCB editor background, for footprints).
	 */
	background?: 'light' | 'dark';
};

/**
 * A selectable entry of a preview list that is not an attachment, e.g. the part's symbol,
 * footprint or footprint 3D model. `key` must be unique within the list.
 */
export type PreviewEntry = {
	key: string;
	/** Heading the entry is listed under (entries with the same group are listed together). */
	group: string;
	label: string;
	/** Secondary text, e.g. the library name. */
	detail?: string;
	icon?: import('svelte').Component<{ class?: string }>;
	/** null when there is nothing to show (the preview then says so). */
	preview: PreviewSource | null;
	/** Shown in the preview area when `preview` is null. */
	emptyText?: string;
};
