import { Schema } from "effect";

import { normalizeName } from "./utils/normalize";

export const filterKeys = [
	"channel",
	"dancer1",
	"dancer2",
	"event",
	"orchestra",
	"singer",
	"song",
	"year",
] as const;
export const FilterKey = Schema.Literals(filterKeys);
export const ResultFilter = Schema.Literals([
	"channel",
	"dancer",
	"event",
	"orchestra",
	"singer",
	"song",
	"year",
]);
export type ResultFilter = typeof ResultFilter.Type;

const NullableText = Schema.NullOr(Schema.String);

export const SearchFilters = Schema.Record(FilterKey, NullableText);
export type SearchFilters = typeof SearchFilters.Type;

export const FilterOptions = Schema.Array(
	Schema.Struct({ count: Schema.Number, label: Schema.String, value: Schema.String }),
);
export const SearchOptions = Schema.Record(FilterKey, FilterOptions);
export type SearchOptions = typeof SearchOptions.Type;

export const SearchVideo = Schema.Struct({
	channelId: Schema.String,
	channelTitle: Schema.String,
	dancers: Schema.Array(Schema.String),
	event: NullableText,
	id: Schema.String,
	orchestra: Schema.String,
	singers: Schema.Array(Schema.String),
	songTitle: Schema.String,
	title: Schema.String,
	year: Schema.NullOr(Schema.Number),
});
export type SearchVideo = typeof SearchVideo.Type;

export type SearchParamKey = keyof SearchFilters | "page";
export type FilterChanges = Partial<SearchFilters>;

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

export function toggleResultFilter(
	filters: SearchFilters,
	type: ResultFilter,
	value: string,
): FilterChanges {
	if (type !== "dancer") {
		return { [type]: isSameResultFilterValue(type, filters[type], value) ? null : value };
	}
	if (isSameResultFilterValue(type, filters.dancer1, value)) {
		return { dancer1: null };
	}
	if (isSameResultFilterValue(type, filters.dancer2, value)) {
		return { dancer2: null };
	}
	if (filters.dancer1 === null) {
		return { dancer1: value };
	}
	if (filters.dancer2 === null) {
		return { dancer2: value };
	}

	return {};
}

export function readSearch(read: (key: SearchParamKey) => string | null | undefined) {
	const requestedPage = Number.parseInt(read("page") || "1", 10) || 1;

	return {
		filters: {
			channel: read("channel") || null,
			dancer1: read("dancer1") || null,
			dancer2: read("dancer2") || null,
			event: read("event") || null,
			orchestra: read("orchestra") || null,
			singer: read("singer") || null,
			song: read("song") || null,
			year: read("year") || null,
		},
		page: Math.max(1, requestedPage),
	};
}

export function parseSearchParams(params: URLSearchParams) {
	return readSearch((key) => params.get(key));
}
