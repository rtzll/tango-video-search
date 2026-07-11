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
	type ResultFilter,
	type SearchFilters,
	toggleResultFilterSearchParams,
	updateFilterSearchParams,
} from "~/search";

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
	const { dancer1, dancer2, event, orchestra, singer, song, year } = filters;

	const updateSearchParam = (param: keyof SearchFilters, value: string) => {
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
		<div className="mx-auto flex min-h-screen max-w-350 flex-col gap-6 p-6">
			<div className="flex flex-col gap-3">
				<div>
					<SearchControls
						filters={filters}
						onFilterChange={updateSearchParam}
						onReset={resetSearchParams}
						options={options}
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
						className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
						key={searchParams.toString()}
					>
						{initialVideos.map((video) => (
							<VideoCard
								video={video}
								key={video.id}
								onFilterClick={handleFilterClick}
								activeFilters={{
									dancers: [dancer1, dancer2],
									event,
									orchestra,
									singer,
									song,
									year,
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
					<span className="text-muted text-xs">Data refreshed: {formattedLastUpdate}</span>
					<a
						href="https://github.com/rtzll/tango-video-search"
						target="_blank"
						rel="noopener noreferrer"
						className="text-muted inline-flex items-center gap-1 text-xs hover:underline"
					>
						Source code
						<GitHubLogoIcon width={12} height={12} />
					</a>
				</div>
			</div>
		</div>
	);
}
