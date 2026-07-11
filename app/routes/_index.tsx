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

interface FilterOption {
	id: number;
	name: string;
	count: number;
}

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

function OptionalFilter({
	available,
	label,
	onValueChange,
	options,
	value,
}: {
	available: boolean;
	label: string;
	onValueChange: (value: string) => void;
	options: FilterOption[];
	value: string;
}) {
	const article = label === "event" ? "an" : "a";

	if (value === ANY_FILTER_VALUE) {
		return available ? (
			<Combobox
				value={ANY_FILTER_VALUE}
				onValueChange={onValueChange}
				options={options}
				placeholder={`+ ${label}`}
				searchLabel={label}
				ariaLabel={`Add ${article} ${label} filter`}
				includeEmptyOption={false}
				showCaret={false}
			/>
		) : null;
	}

	return (
		<button
			type="button"
			onClick={() => onValueChange(ANY_FILTER_VALUE)}
			className="bg-accent-soft hover:bg-accent-soft-hover text-accent-text inline-flex max-w-full cursor-pointer items-center gap-1 rounded-sm px-2 py-1 text-xs"
		>
			<span className="truncate">
				{label.charAt(0).toUpperCase() + label.slice(1)}: {value}
			</span>
			<Cross1Icon className="shrink-0" />
		</button>
	);
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
						className="border-border text-accent-text inline-flex cursor-not-allowed items-center gap-1 rounded-sm border px-2 py-1 text-xs opacity-50"
					>
						<ChevronLeftIcon width={14} height={14} />
						Previous
					</button>
				) : (
					<RouterLink
						to={getPageHref(page - 1)}
						className="border-border text-accent-text hover:bg-accent-soft inline-flex items-center gap-1 rounded-sm border px-2 py-1 text-xs"
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
						className="border-border text-accent-text inline-flex cursor-not-allowed items-center gap-1 rounded-sm border px-2 py-1 text-xs opacity-50"
					>
						Next
						<ChevronRightIcon width={14} height={14} />
					</button>
				) : (
					<RouterLink
						to={getPageHref(page + 1)}
						className="border-border text-accent-text hover:bg-accent-soft inline-flex items-center gap-1 rounded-sm border px-2 py-1 text-xs"
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
	const {
		filters: { dancer1, dancer2, event, orchestra, singer, song },
	} = parseSearchParams(searchParams);
	const hasAnyFilters =
		dancer1 !== ANY_FILTER_VALUE ||
		dancer2 !== ANY_FILTER_VALUE ||
		event !== ANY_FILTER_VALUE ||
		orchestra !== ANY_FILTER_VALUE ||
		song !== ANY_FILTER_VALUE ||
		singer !== ANY_FILTER_VALUE;
	const canAddSong = songOptions.length > 0;
	const canAddSinger = singerOptions.length > 0;
	const canAddEvent = eventOptions.length > 0;
	const showOptionalFilters =
		canAddSong ||
		canAddSinger ||
		canAddEvent ||
		song !== ANY_FILTER_VALUE ||
		singer !== ANY_FILTER_VALUE ||
		event !== ANY_FILTER_VALUE;

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
								className="bg-accent-soft hover:bg-accent-soft-hover text-accent-text inline-flex h-6 w-6 cursor-pointer items-center justify-center rounded-sm"
							>
								<ResetIcon width={12} height={12} />
							</button>
						)}
					</div>
					{showOptionalFilters && (
						<div className="relative mt-2 flex flex-wrap items-center gap-2">
							<OptionalFilter
								available={canAddSong}
								label="song"
								onValueChange={(value) => updateSearchParam("song", value)}
								options={songOptions}
								value={song}
							/>
							<OptionalFilter
								available={canAddSinger}
								label="singer"
								onValueChange={(value) => updateSearchParam("singer", value)}
								options={singerOptions}
								value={singer}
							/>
							<OptionalFilter
								available={canAddEvent}
								label="event"
								onValueChange={(value) => updateSearchParam("event", value)}
								options={eventOptions}
								value={event}
							/>
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
