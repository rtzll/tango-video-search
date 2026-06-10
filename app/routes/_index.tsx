import {
	ChevronLeftIcon,
	ChevronRightIcon,
	GitHubLogoIcon,
	ResetIcon,
} from "@radix-ui/react-icons";
import { Link as RouterLink, useSearchParams } from "react-router";

import { Combobox } from "~/components/combobox";
import { VideoCard } from "~/components/video-card";
import {
	getDancerOptions,
	getFilteredVideos,
	getFilteredVideosCount,
	getLastDatabaseUpdateTime,
	getOrchestraOptions,
} from "~/db.server";
import { normalizeName } from "~/utils/normalize";

import type { Route } from "./+types/_index";

const PAGE_SIZE = 42;

export function meta() {
	return [
		{ title: "Tango Video Search" },
		{ content: "A different way to find tango videos.", name: "description" },
	];
}

export async function loader({ url }: Route.LoaderArgs) {
	const dancer1 = url.searchParams.get("dancer1") || "any";
	const dancer2 = url.searchParams.get("dancer2") || "any";
	const orchestra = url.searchParams.get("orchestra") || "any";
	const pageParam = url.searchParams.get("page");
	const page = Math.max(1, Number.parseInt(pageParam || "1", 10) || 1);

	const [dancerOneOptions, dancerTwoOptions, orchestraOptions, totalVideos] = await Promise.all([
		getDancerOptions(dancer2, orchestra),
		getDancerOptions(dancer1, orchestra),
		getOrchestraOptions(dancer1, dancer2),
		getFilteredVideosCount(dancer1, dancer2, orchestra),
	]);
	const totalPages = Math.max(1, Math.ceil(totalVideos / PAGE_SIZE));
	const safePage = Math.min(page, totalPages);
	const transformedVideos = await getFilteredVideos(
		dancer1,
		dancer2,
		orchestra,
		safePage,
		PAGE_SIZE,
	);

	const lastUpdateTime = getLastDatabaseUpdateTime();
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
		totalPages,
		totalVideos,
	};
}

function isSameFilterValue(current: string, candidate: string) {
	return current !== "any" && normalizeName(current) === normalizeName(candidate);
}

export default function SearchInterface({ loaderData }: Route.ComponentProps) {
	const {
		dancerOneOptions,
		dancerTwoOptions,
		orchestraOptions,
		initialVideos,
		formattedLastUpdate,
		page,
		totalPages,
		totalVideos,
	} = loaderData;

	const [searchParams, setSearchParams] = useSearchParams();
	const dancer1 = searchParams.get("dancer1") || "any";
	const dancer2 = searchParams.get("dancer2") || "any";
	const orchestra = searchParams.get("orchestra") || "any";

	const updateSearchParam = (param: string, value: string) => {
		const newParams = new URLSearchParams(searchParams);
		if (value === "any") {
			newParams.delete(param);
		} else {
			newParams.set(param, value);
		}
		newParams.delete("page");
		setSearchParams(newParams);
	};
	const resetSearchParams = () => setSearchParams(new URLSearchParams());

	const handleFilterClick = (type: "dancer" | "orchestra", value: string) => {
		const newParams = new URLSearchParams(searchParams);

		if (type === "dancer") {
			if (isSameFilterValue(dancer1, value)) {
				newParams.delete("dancer1");
			} else if (isSameFilterValue(dancer2, value)) {
				newParams.delete("dancer2");
			} else if (dancer1 === "any" && dancer2 === "any") {
				newParams.set("dancer1", value);
			} else if (dancer1 !== "any" && dancer2 === "any" && !isSameFilterValue(dancer1, value)) {
				newParams.set("dancer2", value);
			} else if (dancer1 === "any" && dancer2 !== "any" && !isSameFilterValue(dancer2, value)) {
				newParams.set("dancer1", value);
			}
		} else if (type === "orchestra") {
			if (isSameFilterValue(orchestra, value)) {
				newParams.delete("orchestra");
			} else {
				newParams.set("orchestra", value);
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

	return (
		<div className="flex flex-col gap-6 p-6 max-w-[1400px] mx-auto min-h-screen">
			<div>
				<div className="flex items-baseline gap-2 flex-wrap">
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
					{/* TODO: allow for selecting songs and singers too */}
					<Combobox
						value={orchestra}
						onValueChange={(value) => updateSearchParam("orchestra", value)}
						options={orchestraOptions}
						placeholder="any orchestra"
						searchLabel="orchestra"
						ariaLabel="Select orchestra"
					/>
					{(dancer1 !== "any" || dancer2 !== "any" || orchestra !== "any") && (
						<button
							type="button"
							onClick={resetSearchParams}
							aria-label="Reset filters"
							className="inline-flex items-center justify-center w-6 h-6 bg-[var(--color-accent-soft)] hover:bg-[var(--color-accent-soft-hover)] text-[var(--color-accent-text)] cursor-pointer"
						>
							<ResetIcon width={12} height={12} />
						</button>
					)}
				</div>
			</div>

			{/* TODO: add number of performances for filter and reset filter button */}
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
						}}
					/>
				))}
			</div>

			<div className="flex items-center justify-between gap-3 flex-wrap">
				<span className="text-xs text-[var(--color-muted)]">
					{totalVideos === 0 ? "No results" : `Showing ${startIndex}–${endIndex} of ${totalVideos}`}
				</span>
				<div className="flex items-center gap-2">
					{page <= 1 ? (
						<button
							type="button"
							disabled
							className="inline-flex items-center gap-1 px-2 py-1 text-xs border border-[var(--color-border)] text-[var(--color-accent-text)] opacity-50 cursor-not-allowed"
						>
							<ChevronLeftIcon width={14} height={14} />
							Previous
						</button>
					) : (
						<RouterLink
							to={getPageHref(page - 1)}
							className="inline-flex items-center gap-1 px-2 py-1 text-xs border border-[var(--color-border)] text-[var(--color-accent-text)] hover:bg-[var(--color-accent-soft)]"
						>
							<ChevronLeftIcon width={14} height={14} />
							Previous
						</RouterLink>
					)}
					<span className="text-xs text-[var(--color-muted)]">
						Page {page} of {totalPages}
					</span>
					{page >= totalPages ? (
						<button
							type="button"
							disabled
							className="inline-flex items-center gap-1 px-2 py-1 text-xs border border-[var(--color-border)] text-[var(--color-accent-text)] opacity-50 cursor-not-allowed"
						>
							Next
							<ChevronRightIcon width={14} height={14} />
						</button>
					) : (
						<RouterLink
							to={getPageHref(page + 1)}
							className="inline-flex items-center gap-1 px-2 py-1 text-xs border border-[var(--color-border)] text-[var(--color-accent-text)] hover:bg-[var(--color-accent-soft)]"
						>
							Next
							<ChevronRightIcon width={14} height={14} />
						</RouterLink>
					)}
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
