import { ANY_FILTER_VALUE } from "./utils/filters";

interface SearchFilters {
	dancer1: string;
	dancer2: string;
	event: string;
	orchestra: string;
	singer: string;
	song: string;
}

interface SearchState {
	filters: SearchFilters;
	page: number;
}

function getFilter(searchParams: URLSearchParams, key: keyof SearchFilters) {
	return searchParams.get(key) || ANY_FILTER_VALUE;
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
		},
		page: Math.max(1, requestedPage),
	};
}
