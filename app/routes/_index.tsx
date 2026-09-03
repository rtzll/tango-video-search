import { GitHubLogoIcon } from "@radix-ui/react-icons";
import * as stylex from "@stylexjs/stylex";
import { useSearchParams } from "react-router";

import { ResultsNavigation } from "~/components/results-navigation";
import { SearchControls } from "~/components/search-controls";
import { VideoCard } from "~/components/video-card";
import { getCloudflareRuntime } from "~/context.server";
import { createDatabase, loadSearchPage } from "~/db.server";
import {
	getPageHref as createPageHref,
	parseSearchParams,
	type ResultFilter,
	type SearchFilters,
	toggleResultFilterSearchParams,
	updateFilterSearchParams,
} from "~/search";

import { colors } from "../styles/tokens.stylex";
import type { Route } from "./+types/_index";

const PAGE_SIZE = 18;

export function meta() {
	return [
		{ title: "Tango Video Search" },
		{ content: "A different way to find tango videos.", name: "description" },
	];
}

export async function loader({ context, url }: Route.LoaderArgs) {
	const db = createDatabase(getCloudflareRuntime(context).env.DB);
	const { filters, page: requestedPage } = parseSearchParams(url.searchParams);
	const { lastUpdateTime, ...searchPage } = await loadSearchPage(db, {
		filters,
		page: requestedPage,
		pageSize: PAGE_SIZE,
	});

	const formattedLastUpdate = lastUpdateTime
		? new Intl.DateTimeFormat("en-US", {
				day: "numeric",
				month: "long",
				timeZone: "UTC",
				year: "numeric",
			}).format(lastUpdateTime)
		: "Unknown";

	return {
		formattedLastUpdate,
		...searchPage,
	};
}

export default function SearchInterface({ loaderData }: Route.ComponentProps) {
	const { initialVideos, formattedLastUpdate, options, page, totalPages, totalVideos } = loaderData;

	const [searchParams, setSearchParams] = useSearchParams();
	const { filters } = parseSearchParams(searchParams);

	const updateSearchParam = <Key extends keyof SearchFilters>(
		param: Key,
		value: SearchFilters[Key],
	) => {
		setSearchParams(updateFilterSearchParams(searchParams, param, value));
	};
	const resetSearchParams = () => setSearchParams(new URLSearchParams());

	const handleFilterClick = (type: ResultFilter, value: string) => {
		setSearchParams(toggleResultFilterSearchParams(searchParams, type, value));
	};
	const getPageHref = (nextPage: number) => createPageHref(searchParams, nextPage);

	const startIndex = totalVideos === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
	const endIndex = Math.min(page * PAGE_SIZE, totalVideos);
	const formattedTotalVideos = totalVideos.toLocaleString("en-US");
	const resultText =
		totalVideos === 0
			? "No performances match these filters."
			: `Showing ${startIndex}–${endIndex} of ${formattedTotalVideos} performances`;

	return (
		<div {...stylex.props(styles.page)}>
			<div {...stylex.props(styles.section)}>
				<div>
					<SearchControls
						filters={filters}
						onFilterChange={updateSearchParam}
						onReset={resetSearchParams}
						options={options}
					/>
					<div {...stylex.props(styles.topNavigation)}>
						<ResultsNavigation
							announce
							ariaLabel="Results pages, top"
							getPageHref={getPageHref}
							page={page}
							resultText={resultText}
							totalPages={totalPages}
						/>
					</div>
				</div>

				<div {...stylex.props(styles.section)}>
					<div {...stylex.props(styles.videoGrid)} key={searchParams.toString()}>
						{initialVideos.map((video) => (
							<VideoCard
								video={video}
								key={video.id}
								onFilterClick={handleFilterClick}
								filters={filters}
							/>
						))}
					</div>

					<ResultsNavigation
						ariaLabel="Results pages, bottom"
						getPageHref={getPageHref}
						page={page}
						resultText={resultText}
						totalPages={totalPages}
					/>
				</div>
			</div>

			<div {...stylex.props(styles.footer)}>
				<div {...stylex.props(styles.footerRow)}>
					<span {...stylex.props(styles.updatedAt)}>Data refreshed: {formattedLastUpdate}</span>
					<a
						href="https://github.com/rtzll/tango-video-search"
						target="_blank"
						rel="noopener noreferrer"
						{...stylex.props(styles.sourceLink)}
					>
						Source code
						<GitHubLogoIcon width={12} height={12} />
					</a>
				</div>
			</div>
		</div>
	);
}

const styles = stylex.create({
	footer: { marginTop: "auto", paddingTop: "1rem" },
	footerRow: {
		alignItems: "baseline",
		display: "flex",
		flexWrap: "wrap",
		justifyContent: "space-between",
	},
	page: {
		display: "flex",
		flexDirection: "column",
		gap: "1.5rem",
		marginInline: "auto",
		maxWidth: "87.5rem",
		minHeight: "100vh",
		padding: "1.5rem",
	},
	section: { display: "flex", flexDirection: "column", gap: "0.75rem" },
	sourceLink: {
		alignItems: "center",
		color: colors.muted,
		display: "inline-flex",
		fontSize: "0.75rem",
		gap: "0.25rem",
		lineHeight: "1rem",
		textDecorationLine: { "@media (hover: hover)": { ":hover": "underline" }, default: "none" },
	},
	topNavigation: { marginTop: { "@media (min-width: 40rem)": "0.5rem", default: "1rem" } },
	updatedAt: { color: colors.muted, fontSize: "0.75rem", lineHeight: "1rem" },
	videoGrid: {
		display: "grid",
		gap: "1rem",
		gridTemplateColumns: {
			"@media (min-width: 40rem)": "repeat(2, minmax(0, 1fr))",
			"@media (min-width: 64rem)": "repeat(3, minmax(0, 1fr))",
			default: "minmax(0, 1fr)",
		},
	},
});
