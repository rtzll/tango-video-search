import { normalizeName } from "./utils/normalize";

export type ResultFilter =
	| "channel"
	| "dancer"
	| "event"
	| "orchestra"
	| "singer"
	| "song"
	| "year";

export interface FilterOption<Value extends string = string> {
	readonly count: number;
	readonly label: string;
	readonly value: Value;
}

interface FilterValues {
	channel: string;
	dancer1: string;
	dancer2: string;
	event: string;
	orchestra: string;
	singer: string;
	song: string;
	year: string;
}

export type SearchFilters = {
	readonly [Key in keyof FilterValues]: FilterValues[Key] | null;
};

export type SearchOptions = {
	readonly [Key in keyof FilterValues]: readonly FilterOption<FilterValues[Key]>[];
};

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

interface SearchState {
	filters: SearchFilters;
	page: number;
}

function getFilter(searchParams: URLSearchParams, key: keyof SearchFilters) {
	return searchParams.get(key) || null;
}

export function isSameResultFilterValue(
	type: ResultFilter,
	current: string | null,
	candidate: string,
) {
	if (current === null) {
		return false;
	}
	return type === "channel"
		? current === candidate
		: normalizeName(current) === normalizeName(candidate);
}

export function updateFilterSearchParams<Key extends keyof SearchFilters>(
	searchParams: URLSearchParams,
	key: Key,
	value: SearchFilters[Key],
) {
	const nextSearchParams = new URLSearchParams(searchParams);
	if (value === null) {
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
		if (isSameResultFilterValue(type, dancer1, value)) {
			nextSearchParams.delete("dancer1");
		} else if (isSameResultFilterValue(type, dancer2, value)) {
			nextSearchParams.delete("dancer2");
		} else if (dancer1 === null && dancer2 === null) {
			nextSearchParams.set("dancer1", value);
		} else if (dancer1 !== null && dancer2 === null) {
			nextSearchParams.set("dancer2", value);
		} else if (dancer1 === null && dancer2 !== null) {
			nextSearchParams.set("dancer1", value);
		}
	} else {
		const currentValue = filters[type];
		if (isSameResultFilterValue(type, currentValue, value)) {
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
			channel: getFilter(searchParams, "channel"),
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
