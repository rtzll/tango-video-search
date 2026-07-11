import {
	ChevronLeftIcon,
	ChevronRightIcon,
	Cross1Icon,
	GitHubLogoIcon,
	ResetIcon,
} from "@radix-ui/react-icons";
import { Link as RouterLink, useSearchParams } from "react-router";

import { Combobox } from "~/components/combobox";
import { VideoCard } from "~/components/video-card";
import { getCloudflareRuntime } from "~/context.server";
import {
	createDatabase,
	getDancerOptions,
	getFilteredVideos,
	getFilteredVideosCount,
	getLastDatabaseUpdateTime,
	getOrchestraOptions,
	getSingerOptions,
	getSongOptions,
	type VideoFilters,
} from "~/db.server";
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
	const dancer1 = url.searchParams.get("dancer1") || ANY_FILTER_VALUE;
	const dancer2 = url.searchParams.get("dancer2") || ANY_FILTER_VALUE;
	const orchestra = url.searchParams.get("orchestra") || ANY_FILTER_VALUE;
	const song = url.searchParams.get("song") || ANY_FILTER_VALUE;
	const singer = url.searchParams.get("singer") || ANY_FILTER_VALUE;
	const filters = { dancer1, dancer2, orchestra, singer, song } satisfies VideoFilters;
	const pageParam = url.searchParams.get("page");
	const page = Math.max(1, Number.parseInt(pageParam || "1", 10) || 1);

	const [
		dancerOneOptions,
		dancerTwoOptions,
		orchestraOptions,
		songOptions,
		singerOptions,
		totalVideos,
		lastUpdateTime,
	] = await Promise.all([
		getDancerOptions(db, filters, "dancer1"),
		getDancerOptions(db, filters, "dancer2"),
		getOrchestraOptions(db, filters),
		getSongOptions(db, filters),
		getSingerOptions(db, filters),
		getFilteredVideosCount(db, filters),
		getLastDatabaseUpdateTime(db),
	]);
	const totalPages = Math.max(1, Math.ceil(totalVideos / PAGE_SIZE));
	const safePage = Math.min(page, totalPages);
	const transformedVideos = await getFilteredVideos(db, filters, safePage, PAGE_SIZE);

	const formattedLastUpdate = lastUpdateTime
		? new Intl.DateTimeFormat("en-US", {
				day: "numeric",
				month: "long",
				timeZone: "UTC",
				year: "numeric",
			}).format(lastUpdateTime)
		: "Unknown";

	return {
		dancerOneOptions,
		dancerTwoOptions,
		formattedLastUpdate,
		initialVideos: transformedVideos,
		orchestraOptions,
		page: safePage,
		singerOptions,
		songOptions,
		totalPages,
		totalVideos,
	};
}

function isSameFilterValue(current: string, candidate: string) {
	return current !== ANY_FILTER_VALUE && normalizeName(current) === normalizeName(candidate);
}

function ResultsNavigation({
	announce,
	ariaLabel,
	getPageHref,
	page,
	resultText,
	totalPages,
}: {
	announce?: boolean;
	ariaLabel: string;
	getPageHref: (nextPage: number) => string;
	page: number;
	resultText: string;
	totalPages: number;
}) {
	return (
		<div className="flex flex-wrap items-center justify-between gap-3">
			<span className="text-muted text-sm" aria-live={announce ? "polite" : undefined}>
				{resultText}
			</span>
			<nav className="flex items-center gap-2" aria-label={ariaLabel}>
				{page <= 1 ? (
					<button
						type="button"
						disabled
						className="border-border text-accent-text inline-flex cursor-not-allowed items-center gap-1 border px-2 py-1 text-xs opacity-50"
					>
						<ChevronLeftIcon width={14} height={14} />
						Previous
					</button>
				) : (
					<RouterLink
						to={getPageHref(page - 1)}
						className="border-border text-accent-text hover:bg-accent-soft inline-flex items-center gap-1 border px-2 py-1 text-xs"
					>
						<ChevronLeftIcon width={14} height={14} />
						Previous
					</RouterLink>
				)}
				<span className="text-muted text-xs">
					Page {page} of {totalPages}
				</span>
				{page >= totalPages ? (
					<button
						type="button"
						disabled
						className="border-border text-accent-text inline-flex cursor-not-allowed items-center gap-1 border px-2 py-1 text-xs opacity-50"
					>
						Next
						<ChevronRightIcon width={14} height={14} />
					</button>
				) : (
					<RouterLink
						to={getPageHref(page + 1)}
						className="border-border text-accent-text hover:bg-accent-soft inline-flex items-center gap-1 border px-2 py-1 text-xs"
					>
						Next
						<ChevronRightIcon width={14} height={14} />
					</RouterLink>
				)}
			</nav>
		</div>
	);
}

export default function SearchInterface({ loaderData }: Route.ComponentProps) {
	const {
		dancerOneOptions,
		dancerTwoOptions,
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
	const dancer1 = searchParams.get("dancer1") || ANY_FILTER_VALUE;
	const dancer2 = searchParams.get("dancer2") || ANY_FILTER_VALUE;
	const orchestra = searchParams.get("orchestra") || ANY_FILTER_VALUE;
	const song = searchParams.get("song") || ANY_FILTER_VALUE;
	const singer = searchParams.get("singer") || ANY_FILTER_VALUE;
	const hasAnyFilters =
		dancer1 !== ANY_FILTER_VALUE ||
		dancer2 !== ANY_FILTER_VALUE ||
		orchestra !== ANY_FILTER_VALUE ||
		song !== ANY_FILTER_VALUE ||
		singer !== ANY_FILTER_VALUE;
	const canAddSong = songOptions.length > 0;
	const canAddSinger = singerOptions.length > 0;
	const showOptionalFilters =
		canAddSong || canAddSinger || song !== ANY_FILTER_VALUE || singer !== ANY_FILTER_VALUE;

	const updateSearchParam = (param: string, value: string) => {
		const newParams = new URLSearchParams(searchParams);
		if (value === ANY_FILTER_VALUE) {
			newParams.delete(param);
		} else {
			newParams.set(param, value);
		}
		newParams.delete("page");
		setSearchParams(newParams);
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
	const getPageHref = (nextPage: number) => {
		const newParams = new URLSearchParams(searchParams);
		if (nextPage <= 1) {
			newParams.delete("page");
		} else {
			newParams.set("page", String(nextPage));
		}
		const query = newParams.toString();
		return query ? `?${query}` : ".";
	};

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
					<div className="relative flex flex-wrap items-baseline gap-2">
						<span>I want to see</span>
						<Combobox
							value={dancer1}
							onValueChange={(value) => updateSearchParam("dancer1", value)}
							options={dancerOneOptions}
							placeholder="any dancer"
							searchLabel="dancer"
							ariaLabel="Select first dancer"
						/>
						<span>and</span>
						<Combobox
							value={dancer2}
							onValueChange={(value) => updateSearchParam("dancer2", value)}
							options={dancerTwoOptions}
							placeholder="any dancer"
							searchLabel="dancer"
							ariaLabel="Select second dancer"
						/>
						<span>dance to</span>
						<Combobox
							value={orchestra}
							onValueChange={(value) => updateSearchParam("orchestra", value)}
							options={orchestraOptions}
							placeholder="any orchestra"
							searchLabel="orchestra"
							ariaLabel="Select orchestra"
						/>
						{hasAnyFilters && (
							<button
								type="button"
								onClick={resetSearchParams}
								aria-label="Reset filters"
								className="bg-accent-soft hover:bg-accent-soft-hover text-accent-text inline-flex h-6 w-6 cursor-pointer items-center justify-center"
							>
								<ResetIcon width={12} height={12} />
							</button>
						)}
					</div>
					{showOptionalFilters && (
						<div className="relative mt-2 flex flex-wrap items-center gap-2">
							{song === ANY_FILTER_VALUE ? (
								canAddSong ? (
									<Combobox
										value={ANY_FILTER_VALUE}
										onValueChange={(value) => updateSearchParam("song", value)}
										options={songOptions}
										placeholder="+ song"
										searchLabel="song"
										ariaLabel="Add a song filter"
										includeEmptyOption={false}
										showCaret={false}
									/>
								) : null
							) : (
								<button
									type="button"
									onClick={() => updateSearchParam("song", ANY_FILTER_VALUE)}
									className="bg-accent-soft hover:bg-accent-soft-hover text-accent-text inline-flex cursor-pointer items-center gap-1 px-2 py-1 text-xs"
								>
									Song: {song}
									<Cross1Icon />
								</button>
							)}
							{singer === ANY_FILTER_VALUE ? (
								canAddSinger ? (
									<Combobox
										value={ANY_FILTER_VALUE}
										onValueChange={(value) => updateSearchParam("singer", value)}
										options={singerOptions}
										placeholder="+ singer"
										searchLabel="singer"
										ariaLabel="Add a singer filter"
										includeEmptyOption={false}
										showCaret={false}
									/>
								) : null
							) : (
								<button
									type="button"
									onClick={() => updateSearchParam("singer", ANY_FILTER_VALUE)}
									className="bg-accent-soft hover:bg-accent-soft-hover text-accent-text inline-flex cursor-pointer items-center gap-1 px-2 py-1 text-xs"
								>
									Singer: {singer}
									<Cross1Icon />
								</button>
							)}
						</div>
					)}
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
