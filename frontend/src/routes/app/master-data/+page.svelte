<script lang="ts">
	import {
		ArrowDownFromLineIcon,
		CircuitBoardIcon,
		FactoryIcon,
		LayoutListIcon,
		MicrochipIcon,
		PackageOpenIcon,
		RulerIcon,
		TagIcon
	} from '@lucide/svelte';
	import StatCard from '#lib/components/stat-card.svelte';
	import { getCollectionStats } from '#lib/data/stats.ts';
	import type {
		CategoriesRecord,
		Collections,
		DesignatorsRecord,
		DistributorsRecord,
		FootprintsRecord,
		ManufacturersRecord,
		SymbolsRecord,
		TagsRecord,
		UnitsRecord
	} from '#lib/data/pocketbase-types.ts';

	/** A piece of flavor text; the interpolated names are shown in bold. */
	type Segment = { text: string; bold: boolean };
	type Stats = { count: number; flavor: Segment[] };

	/** Tagged template that marks every interpolated value as bold. */
	function bold(strings: TemplateStringsArray, ...names: (string | undefined)[]): Segment[] {
		return strings.flatMap((text, i) => {
			const segment = { text, bold: false };
			return i < names.length ? [segment, { text: names[i] ?? '', bold: true }] : [segment];
		});
	}

	/** Loads the count and turns the latest record (if any) into flavor text. */
	function stats<T>(collection: Collections, flavor: (latest: T) => Segment[]) {
		return async (): Promise<Stats> => {
			const { count, latest } = await getCollectionStats<T>(collection);
			return { count, flavor: latest ? flavor(latest) : [] };
		};
	}

	const cards = [
		{
			title: 'Total Categories',
			href: '/app/master-data/categories',
			icon: LayoutListIcon,
			load: stats<CategoriesRecord>(
				'categories',
				(c) => bold`Your scientists discovered a brand new tech and called it ${c.name}.`
			)
		},
		{
			title: 'Total Designators',
			href: '/app/master-data/designators',
			icon: ArrowDownFromLineIcon,
			load: stats<DesignatorsRecord>(
				'designators',
				(d) =>
					bold`Some lazy fool decided that ${d.designatorString} was a good acronym for ${d.name}.`
			)
		},
		{
			title: 'Total Symbols',
			href: '/app/master-data/symbols',
			icon: MicrochipIcon,
			load: stats<SymbolsRecord>(
				'symbols',
				(s) =>
					bold`During the recent reorganization of the archive a clerk discovered an ancient scroll with a sketch of a machine called ${s.name}.`
			)
		},
		{
			title: 'Total Footprints',
			href: '/app/master-data/footprints',
			icon: CircuitBoardIcon,
			load: stats<FootprintsRecord>(
				'footprints',
				(f) =>
					bold`Your engineers finished the floor plans for ${f.name}. This technology will lead us to a brighter future.`
			)
		},
		{
			title: 'Total Units',
			href: '/app/master-data/units',
			icon: RulerIcon,
			load: stats<UnitsRecord>(
				'units',
				(u) =>
					bold`Recent discoveries by your researchers have required the definition of the unit ${u.name}.`
			)
		},
		{
			title: 'Total Manufacturers',
			href: '/app/master-data/manufacturers',
			icon: FactoryIcon,
			load: stats<ManufacturersRecord>(
				'manufacturers',
				(m) => bold`Your pioneers set feet in ${m.name} land and began negotiating trades.`
			)
		},
		{
			title: 'Total Distributors',
			href: '/app/master-data/distributors',
			icon: PackageOpenIcon,
			load: stats<DistributorsRecord>(
				'distributors',
				(d) =>
					bold`A new trade company emerged and tries to set foot in your empire. They call themselves the ${d.name + 's'}.`
			)
		},
		{
			title: 'Total Tags',
			href: '/app/master-data/tags',
			icon: TagIcon,
			load: stats<TagsRecord>(
				'tags',
				(t) =>
					bold`A new ${t.name + '-Shop'} opened today. It stocks the most important ${t.name} products.`
			)
		}
	];

	let results: Stats[] = $state([]);

	Promise.all(cards.map((card) => card.load())).then((loaded) => (results = loaded));
</script>

<div class="grid grid-cols-1 gap-4 px-4 sm:grid-cols-2 lg:px-6 xl:grid-cols-4">
	{#each cards as card, i (card.href)}
		<StatCard title={card.title} href={card.href} icon={card.icon} count={results[i]?.count ?? 0}>
			{#snippet footer()}
				<p>
					{#each results[i]?.flavor ?? [] as segment, j (j)}<span class:font-bold={segment.bold}
							>{segment.text}</span
						>{/each}
				</p>
			{/snippet}
		</StatCard>
	{/each}
</div>
