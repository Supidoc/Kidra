import type { Attachment } from 'svelte/attachments';

/** Attach to a table row: focuses the row's first cell editor when `active` becomes true. */
export function focusFirstEditor(active: boolean): Attachment<HTMLElement> {
	return (row) => {
		if (active) row.querySelector<HTMLElement>('[data-cell-editor] :is(input, button)')?.focus();
	};
}
