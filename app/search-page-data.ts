import { Query } from "@effect/ui";
import { Record, Schema, SchemaGetter } from "effect";

import { FilterOptions, SearchFilters, SearchOptions, SearchVideo, filterKeys } from "./search";

export const PAGE_SIZE = 18;
export const resultsPath = "/api/search";
export const facetsPath = "/api/search/options";

export const SearchResults = Schema.Struct({
	initialVideos: Schema.Array(SearchVideo),
	page: Schema.Number,
	totalPages: Schema.Number,
	totalVideos: Schema.Number,
});

// The wire payload stores [label, count] and includes a value only when
// it differs from the label, as it does for channel IDs.
const CompactOption = Schema.Tuple([
	Schema.String,
	Schema.Number,
	Schema.optionalKey(Schema.String),
]);
const CompactOptions = Schema.Array(CompactOption);
const FacetOptionsPayload = Schema.StructWithRest(
	Schema.Struct({ dancer2: Schema.optionalKey(CompactOptions) }),
	[Schema.Record(Schema.Literals(filterKeys.filter((key) => key !== "dancer2")), CompactOptions)],
);
const sameOptions = Schema.toEquivalence(FilterOptions);

const packOptions = (options: typeof FilterOptions.Type): typeof CompactOptions.Type =>
	options.map(({ label, count, value }) =>
		label === value ? [label, count] : [label, count, value],
	);
const unpackOptions = (options: typeof CompactOptions.Type): typeof FilterOptions.Type =>
	options.map(([label, count, value]) => ({ label, count, value: value ?? label }));

const FacetOptions = FacetOptionsPayload.pipe(
	Schema.decodeTo(SearchOptions, {
		decode: SchemaGetter.transform(({ dancer2, ...options }) => {
			const decoded = Record.map(options, unpackOptions);
			return {
				...decoded,
				dancer2: dancer2 === undefined ? decoded.dancer1 : unpackOptions(dancer2),
			};
		}),
		encode: SchemaGetter.transform(({ dancer2, ...options }) => {
			const encoded = Record.map(options, packOptions);
			return options.dancer1 === dancer2 || sameOptions(options.dancer1, dancer2)
				? encoded
				: { ...encoded, dancer2: packOptions(dancer2) };
		}),
	}),
);

export const SearchFacetsSnapshot = Schema.Struct({
	formattedLastUpdate: Schema.String,
	options: FacetOptions,
});
export type SearchFacets = typeof SearchFacetsSnapshot.Type;

export const encodeSearchFacetsPayload = Schema.encodeSync(
	Schema.toCodecJson(SearchFacetsSnapshot),
);

export const decodeCompactFacetOptions = Schema.decodeUnknownSync(Schema.toCodecJson(FacetOptions));

export class SearchQueryError extends Schema.TaggedError<SearchQueryError>()("SearchQueryError", {
	reason: Schema.Literals(["unavailable", "http-error", "invalid-response", "timeout"]),
}) {}

export class SearchResultsQuery extends Query.Service<SearchResultsQuery>()("SearchResults", {
	args: { filters: SearchFilters, page: Schema.Number },
	success: SearchResults,
	error: SearchQueryError,
	staleTime: "5 minutes",
}) {}

export class SearchFacetsQuery extends Query.Service<SearchFacetsQuery>()("SearchFacets", {
	args: { filters: SearchFilters },
	success: SearchFacetsSnapshot,
	error: SearchQueryError,
	staleTime: "5 minutes",
}) {}
