export type NavigationItem = {
	title: string;
	url: string;
	items?: NavigationItem[];
};

export const navigation: NavigationItem[] = [
	{
		title: 'Application',
		url: '/app/application',
		items: [
			{ title: 'Parts', url: '/app/application/parts' },
			{ title: 'Checks', url: '/app/application/checks' }
		]
	},
	{
		title: 'Master Data',
		url: '/app/master-data',
		items: [
			{ title: 'Categories', url: '/app/master-data/categories' },
			{ title: 'Designators', url: '/app/master-data/designators' },
			{ title: 'Symbols', url: '/app/master-data/symbols' },
			{ title: 'Footprints', url: '/app/master-data/footprints' },
			{ title: 'Units', url: '/app/master-data/units' },
			{ title: 'Manufacturers', url: '/app/master-data/manufacturers' },
			{ title: 'Distributors', url: '/app/master-data/distributors' },
			{ title: 'Tags', url: '/app/master-data/tags' }
		]
	}
];

export function findNavigationTitle(
	pathname: string,
	items: NavigationItem[] = navigation
): string | undefined {
	for (const item of items) {
		if (item.url === pathname) return item.title;

		const title = item.items && findNavigationTitle(pathname, item.items);
		if (title) return title;
	}
}
