import { ANY_FILTER_VALUE } from "./utils/filters";
import { normalizeName } from "./utils/normalize";

export type ResultFilter = "dancer" | "event" | "orchestra" | "singer" | "song" | "year";

export interface SearchOption {
	count: number;
	id: number;
	name: string;
}

export interface SearchOptions {
	dancer1: SearchOption[];
	dancer2: SearchOption[];
	event: SearchOption[];
	orchestra: SearchOption[];
	singer: SearchOption[];
	song: SearchOption[];
	year: SearchOption[];
}

export interface SearchVideo {
	channelId: string;
	channelTitle: string;
	dancers: string[];
	event: string | null;
	id: string;
	orchestra: string;
	singers: string[];
	songTitle: string;
	title: string;
	year: number | null;
}

export interface SearchFilters {
	dancer1: string;
	dancer2: string;
	event: string;
	orchestra: string;
	singer: string;
	song: string;
	year: string;
}

interface SearchState {
	filters: SearchFilters;
	page: number;
}

function getFilter(searchParams: URLSearchParams, key: keyof SearchFilters) {
	return searchParams.get(key) || ANY_FILTER_VALUE;
}

function isSameFilterValue(current: string, candidate: string) {
	return current !== ANY_FILTER_VALUE && normalizeName(current) === normalizeName(candidate);
}

export function updateFilterSearchParams(
	searchParams: URLSearchParams,
	key: keyof SearchFilters,
	value: string,
) {
	const nextSearchParams = new URLSearchParams(searchParams);
	if (value === ANY_FILTER_VALUE) {
		nextSearchParams.delete(key);
	} else {
		nextSearchParams.set(key, value);
	}
	nextSearchParams.delete("page");
	return nextSearchParams;
}

export function getPageHref(searchParams: URLSearchParams, page: number) {
	const nextSearchParams = new URLSearchParams(searchParams);
	if (page <= 1) {
		nextSearchParams.delete("page");
	} else {
		nextSearchParams.set("page", String(page));
	}
	const query = nextSearchParams.toString();
	return query ? `?${query}` : ".";
}

export function toggleResultFilterSearchParams(
	searchParams: URLSearchParams,
	type: ResultFilter,
	value: string,
) {
	const nextSearchParams = new URLSearchParams(searchParams);
	const { filters } = parseSearchParams(searchParams);
	const { dancer1, dancer2 } = filters;

	if (type === "dancer") {
		if (isSameFilterValue(dancer1, value)) {
			nextSearchParams.delete("dancer1");
		} else if (isSameFilterValue(dancer2, value)) {
			nextSearchParams.delete("dancer2");
		} else if (dancer1 === ANY_FILTER_VALUE && dancer2 === ANY_FILTER_VALUE) {
			nextSearchParams.set("dancer1", value);
		} else if (dancer1 !== ANY_FILTER_VALUE && dancer2 === ANY_FILTER_VALUE) {
			nextSearchParams.set("dancer2", value);
		} else if (dancer1 === ANY_FILTER_VALUE && dancer2 !== ANY_FILTER_VALUE) {
			nextSearchParams.set("dancer1", value);
		}
	} else {
		const currentValue = filters[type];
		if (isSameFilterValue(currentValue, value)) {
			nextSearchParams.delete(type);
		} else {
			nextSearchParams.set(type, value);
		}
	}

	nextSearchParams.delete("page");
	return nextSearchParams;
}

export function parseSearchParams(searchParams: URLSearchParams): SearchState {
	const requestedPage = Number.parseInt(searchParams.get("page") || "1", 10) || 1;

	return {
		filters: {
			dancer1: getFilter(searchParams, "dancer1"),
			dancer2: getFilter(searchParams, "dancer2"),
			event: getFilter(searchParams, "event"),
			orchestra: getFilter(searchParams, "orchestra"),
			singer: getFilter(searchParams, "singer"),
			song: getFilter(searchParams, "song"),
			year: getFilter(searchParams, "year"),
		},
		page: Math.max(1, requestedPage),
	};
}
