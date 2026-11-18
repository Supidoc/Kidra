import { describe, expect, it, vi } from 'vitest';
import { clickableRowProps, isInteractiveTarget } from './row-click.ts';

/** A minimal element tree: `closest` and `contains` are all `isInteractiveTarget` uses. */
type FakeElement = Element & { parent?: FakeElement };

function element(tag: string, parent?: FakeElement, role?: string): FakeElement {
	const node = {
		tag,
		role,
		parent,
		closest(selector: string): Element | null {
			const tags = selector.split(',').map((part) => part.trim());
			for (let current: FakeElement | undefined = node as unknown as FakeElement; current;) {
				const fake = current as unknown as { tag: string; role?: string };
				if (tags.includes(fake.tag) || (fake.role && tags.includes(`[role="${fake.role}"]`)))
					return current;
				current = current.parent;
			}
			return null;
		},
		contains(other: Element | null) {
			for (let current = other as FakeElement | null | undefined; current; current = current.parent)
				if (current === (node as unknown)) return true;
			return false;
		}
	};
	return node as unknown as FakeElement;
}

describe('isInteractiveTarget', () => {
	const row = element('tr', element('table'));
	const cell = element('td', row);

	it('ignores clicks on plain cell content', () => {
		expect(isInteractiveTarget(element('span', cell), row)).toBe(false);
		expect(isInteractiveTarget(cell, row)).toBe(false);
		expect(isInteractiveTarget(null, row)).toBe(false);
	});

	it('detects buttons, inputs, links and their children', () => {
		const button = element('button', cell);
		expect(isInteractiveTarget(button, row)).toBe(true);
		expect(isInteractiveTarget(element('svg', button), row)).toBe(true);
		expect(isInteractiveTarget(element('input', cell), row)).toBe(true);
		expect(isInteractiveTarget(element('a', cell), row)).toBe(true);
		expect(isInteractiveTarget(element('div', cell, 'menuitem'), row)).toBe(true);
	});

	it('ignores interactive ancestors outside the row', () => {
		const outerRow = element('tr', element('button'));
		expect(isInteractiveTarget(element('span', element('td', outerRow)), outerRow)).toBe(false);
	});
});

describe('clickableRowProps', () => {
	it('adds nothing without a handler', () => {
		expect(clickableRowProps(true, undefined)).toEqual({});
	});

	it('marks the selected row', () => {
		const props = clickableRowProps(true, () => {});
		expect(props['data-state']).toBe('selected');
		expect(props['aria-current']).toBe('true');
		expect(clickableRowProps(false, () => {})['data-state']).toBeUndefined();
	});

	it('calls the handler on clicks outside controls and on Enter/Space on the row', () => {
		const onClick = vi.fn();
		const props = clickableRowProps(false, onClick);
		const row = element('tr');
		props.onclick!({ currentTarget: row, target: element('span', row) } as unknown as MouseEvent);
		props.onclick!({ currentTarget: row, target: element('button', row) } as unknown as MouseEvent);
		expect(onClick).toHaveBeenCalledTimes(1);

		const preventDefault = vi.fn();
		const key = (name: string, target: unknown = row) =>
			({ key: name, target, currentTarget: row, preventDefault }) as unknown as KeyboardEvent;
		props.onkeydown!(key('Enter'));
		props.onkeydown!(key(' '));
		props.onkeydown!(key('a'));
		props.onkeydown!(key('Enter', element('input', row))); // typing in a cell editor
		expect(onClick).toHaveBeenCalledTimes(3);
		expect(preventDefault).toHaveBeenCalledTimes(2);
	});
});
