/** Elements inside a row that handle clicks themselves; clicks on them do not select the row. */
const INTERACTIVE =
	'a, button, input, select, textarea, label, [role="button"], [role="checkbox"], [role="combobox"], [role="menuitem"], [role="option"], [contenteditable="true"], [contenteditable=""]';

/** Whether a click on `target` inside `row` came from a control of its own (button, input, …). */
export function isInteractiveTarget(target: EventTarget | null, row: Element): boolean {
	const match = (target as Element | null)?.closest?.(INTERACTIVE);
	return !!match && match !== row && row.contains(match);
}

/**
 * Row props for the `onRowClick` / `selectedRowId` feature of `DataTable` and `TreeTable`:
 * a click (outside the row's own controls) or Enter/Space on the focused row calls `onClick`,
 * and the selected row gets `data-state="selected"` (the shadcn row highlight). The table adds
 * `cursor-pointer` itself, so its own row classes stay in one place.
 */
export function clickableRowProps(selected: boolean, onClick: (() => void) | undefined) {
	if (!onClick) return {};
	return {
		tabindex: 0,
		'data-state': selected ? 'selected' : undefined,
		'aria-current': selected ? ('true' as const) : undefined,
		onclick: (event: MouseEvent) => {
			const row = event.currentTarget as Element;
			if (!isInteractiveTarget(event.target, row)) onClick();
		},
		onkeydown: (event: KeyboardEvent) => {
			if (event.target !== event.currentTarget) return;
			if (event.key === 'Enter' || event.key === ' ') {
				event.preventDefault();
				onClick();
			}
		}
	};
}
