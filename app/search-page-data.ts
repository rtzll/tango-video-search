import { Query } from "@effect/ui";
import { Schema, SchemaGetter } from "effect";

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

const FacetOptionsPayload = Schema.StructWithRest(
	Schema.Struct({ dancer2: Schema.optionalKey(FilterOptions) }),
	[Schema.Record(Schema.Literals(filterKeys.filter((key) => key !== "dancer2")), FilterOptions)],
);
const sameOptions = Schema.toEquivalence(FilterOptions);

// The query cache uses this codec for hydration. Omission means the second
// picker has exactly the same ordered options as the first.
const FacetOptions = FacetOptionsPayload.pipe(
	Schema.decodeTo(SearchOptions, {
		decode: SchemaGetter.transform(({ dancer2, ...options }) => ({
			...options,
			dancer2: dancer2 ?? options.dancer1,
		})),
		encode: SchemaGetter.transform(({ dancer2, ...options }) =>
			sameOptions(options.dancer1, dancer2) ? options : { ...options, dancer2 },
		),
	}),
);

export const SearchFacets = Schema.Struct({
	formattedLastUpdate: Schema.String,
	options: FacetOptions,
});

export class SearchResultsQuery extends Query.Service<SearchResultsQuery>()("SearchResults", {
	args: { filters: SearchFilters, page: Schema.Number },
	success: SearchResults,
	error: Schema.String,
	staleTime: "0 millis",
}) {}

export class SearchFacetsQuery extends Query.Service<SearchFacetsQuery>()("SearchFacets", {
	args: { filters: SearchFilters },
	success: SearchFacets,
	error: Schema.String,
	staleTime: "1 minute",
}) {}
