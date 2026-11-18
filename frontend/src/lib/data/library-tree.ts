/** A top-level row of a two-level tree: a group record with its item rows. */
export type TreeGroupRow<G, I> = G & { kind: 'group'; children: TreeItemRow<I>[] };

/** A leaf row of a two-level tree. */
export type TreeItemRow<I> = I & { kind: 'item'; children?: undefined };

/** Any row of a two-level tree, for `TreeTable` with `getSubRows={(row) => row.children}`. */
export type TreeRow<G, I> = TreeGroupRow<G, I> | TreeItemRow<I>;

/**
 * Nests `items` under their group, keeping the order of both lists. `groupOf` returns an item's
 * group id; items without a matching group are left out.
 */
export function buildTree<G extends { id: string }, I extends { id: string }>(
	groups: G[],
	items: I[],
	groupOf: (item: I) => string | undefined
): TreeGroupRow<G, I>[] {
	const itemsByGroup = new Map<string, TreeItemRow<I>[]>();
	for (const item of items) {
		const groupId = groupOf(item);
		if (!groupId) continue;
		const row: TreeItemRow<I> = { ...item, kind: 'item' };
		itemsByGroup.set(groupId, [...(itemsByGroup.get(groupId) ?? []), row]);
	}
	return groups.map((group) => ({
		...group,
		kind: 'group',
		children: itemsByGroup.get(group.id) ?? []
	}));
}

/** Nests symbol or footprint records under their library (the `library` relation). */
export function buildLibraryTree<
	L extends { id: string },
	I extends { id: string; library?: string }
>(libraries: L[], items: I[]): TreeGroupRow<L, I>[] {
	return buildTree(libraries, items, (item) => item.library);
}

/** The record of a tree row without the tree fields, ready to be written back to PocketBase. */
export function treeRecord<R>(row: R & { kind: 'group' | 'item'; children?: unknown }): R {
	const record: Partial<typeof row> = { ...row };
	delete record.kind;
	delete record.children;
	return record as R;
}
