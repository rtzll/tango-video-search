import { GitHubLogoIcon } from "@radix-ui/react-icons";
import { useSearchParams } from "react-router";

import { ResultsNavigation } from "~/components/results-navigation";
import { SearchControls } from "~/components/search-controls";
import { VideoCard } from "~/components/video-card";
import { getCloudflareRuntime } from "~/context.server";
import { createDatabase, loadSearchPage } from "~/db.server";
import {
	getPageHref as createPageHref,
	parseSearchParams,
	type SearchFilters,
	updateFilterSearchParams,
} from "~/search";
import { ANY_FILTER_VALUE } from "~/utils/filters";
import { normalizeName } from "~/utils/normalize";

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

function isSameFilterValue(current: string, candidate: string) {
	return current !== ANY_FILTER_VALUE && normalizeName(current) === normalizeName(candidate);
}

export default function SearchInterface({ loaderData }: Route.ComponentProps) {
	const {
		dancerOneOptions,
		dancerTwoOptions,
		eventOptions,
		orchestraOptions,
		songOptions,
		singerOptions,
		initialVideos,
		formattedLastUpdate,
		page,
		totalPages,
		totalVideos,
	} = loaderData;

	const [searchParams, setSearchParams] = useSearchParams();
	const { filters } = parseSearchParams(searchParams);
	const { dancer1, dancer2, orchestra, singer, song } = filters;

	const updateSearchParam = (param: keyof SearchFilters, value: string) => {
		setSearchParams(updateFilterSearchParams(searchParams, param, value));
	};
	const resetSearchParams = () => setSearchParams(new URLSearchParams());

	const handleFilterClick = (type: "dancer" | "orchestra" | "singer" | "song", value: string) => {
		const newParams = new URLSearchParams(searchParams);

		if (type === "dancer") {
			if (isSameFilterValue(dancer1, value)) {
				newParams.delete("dancer1");
			} else if (isSameFilterValue(dancer2, value)) {
				newParams.delete("dancer2");
			} else if (dancer1 === ANY_FILTER_VALUE && dancer2 === ANY_FILTER_VALUE) {
				newParams.set("dancer1", value);
			} else if (
				dancer1 !== ANY_FILTER_VALUE &&
				dancer2 === ANY_FILTER_VALUE &&
				!isSameFilterValue(dancer1, value)
			) {
				newParams.set("dancer2", value);
			} else if (
				dancer1 === ANY_FILTER_VALUE &&
				dancer2 !== ANY_FILTER_VALUE &&
				!isSameFilterValue(dancer2, value)
			) {
				newParams.set("dancer1", value);
			}
		} else if (type === "orchestra") {
			if (isSameFilterValue(orchestra, value)) {
				newParams.delete("orchestra");
			} else {
				newParams.set("orchestra", value);
			}
		} else {
			const currentValue = type === "song" ? song : singer;
			if (isSameFilterValue(currentValue, value)) {
				newParams.delete(type);
			} else {
				newParams.set(type, value);
			}
		}

		newParams.delete("page");
		setSearchParams(newParams);
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
		<div className="flex flex-col gap-6 p-6 max-w-[1400px] mx-auto min-h-screen">
			<div className="flex flex-col gap-3">
				<div>
					<SearchControls
						dancerOneOptions={dancerOneOptions}
						dancerTwoOptions={dancerTwoOptions}
						eventOptions={eventOptions}
						filters={filters}
						onFilterChange={updateSearchParam}
						onReset={resetSearchParams}
						orchestraOptions={orchestraOptions}
						singerOptions={singerOptions}
						songOptions={songOptions}
					/>
					<div className="mt-2">
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

				<div className="flex flex-col gap-3">
					<div
						className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4"
						key={searchParams.toString()}
					>
						{initialVideos.map((video) => (
							<VideoCard
								video={video}
								key={video.id}
								onFilterClick={handleFilterClick}
								activeFilters={{
									dancers: [dancer1, dancer2],
									orchestra,
									singer,
									song,
								}}
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

			<div className="mt-auto pt-4">
				<div className="flex items-baseline justify-between flex-wrap">
					<span className="text-xs text-[var(--color-muted)]">
						Data refreshed: {formattedLastUpdate}
					</span>
					<a
						href="https://github.com/rtzll/tango-video-search"
						target="_blank"
						rel="noopener noreferrer"
						className="text-xs text-[var(--color-muted)] hover:underline inline-flex items-center gap-1"
					>
						Source code
						<GitHubLogoIcon width={12} height={12} />
					</a>
				</div>
			</div>
		</div>
	);
}
