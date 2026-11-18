/** A page button (0-based page index) or a gap between page buttons. */
export type PageItem = number | 'ellipsis';

/**
 * Page buttons to show: all pages up to 7, otherwise the first and last page, the current page
 * with its neighbours, and ellipses for the gaps. Always 7 items once there are more than 7 pages.
 */
export function pageItems(pageIndex: number, pageCount: number): PageItem[] {
	if (pageCount <= 7) return Array.from({ length: pageCount }, (_, index) => index);
	const last = pageCount - 1;
	if (pageIndex <= 3) return [0, 1, 2, 3, 4, 'ellipsis', last];
	if (pageIndex >= pageCount - 4)
		return [0, 'ellipsis', last - 4, last - 3, last - 2, last - 1, last];
	return [0, 'ellipsis', pageIndex - 1, pageIndex, pageIndex + 1, 'ellipsis', last];
}
