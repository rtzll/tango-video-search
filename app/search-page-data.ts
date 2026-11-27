import { Query } from "@effect/ui";
import { Schema } from "effect";

import { SearchFilters, SearchOptions, SearchVideo } from "./search";

export const PAGE_SIZE = 18;
export const resultsPath = "/api/search";
export const facetsPath = "/api/search/options";

export const SearchResults = Schema.Struct({
	initialVideos: Schema.Array(SearchVideo),
	page: Schema.Number,
	totalPages: Schema.Number,
	totalVideos: Schema.Number,
});

export const SearchFacets = Schema.Struct({
	formattedLastUpdate: Schema.String,
	options: SearchOptions,
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
