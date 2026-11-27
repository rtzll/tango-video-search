import { Query } from "@effect/ui";
import { Schema } from "effect";

export const PAGE_SIZE = 18;
export const searchDataPath = "/api/search";

const Filter = Schema.NullOr(Schema.String);
const SearchFilters = Schema.Struct({
	channel: Filter,
	dancer1: Filter,
	dancer2: Filter,
	event: Filter,
	orchestra: Filter,
	singer: Filter,
	song: Filter,
	year: Filter,
});

export const FilterOptions = Schema.Array(
	Schema.Struct({ count: Schema.Number, label: Schema.String, value: Schema.String }),
);

const SearchOptions = Schema.Struct({
	channel: FilterOptions,
	dancer1: FilterOptions,
	dancer2: FilterOptions,
	event: FilterOptions,
	orchestra: FilterOptions,
	singer: FilterOptions,
	song: FilterOptions,
	year: FilterOptions,
});

export const SearchPageData = Schema.Struct({
	initialVideos: Schema.Array(
		Schema.Struct({
			channelId: Schema.String,
			channelTitle: Schema.String,
			dancers: Schema.Array(Schema.String),
			event: Filter,
			id: Schema.String,
			orchestra: Schema.String,
			singers: Schema.Array(Schema.String),
			songTitle: Schema.String,
			title: Schema.String,
			year: Schema.NullOr(Schema.Number),
		}),
	),
	formattedLastUpdate: Schema.String,
	options: SearchOptions,
	page: Schema.Number,
	totalPages: Schema.Number,
	totalVideos: Schema.Number,
});

export class SearchPageQuery extends Query.Service<SearchPageQuery>()("SearchPageQuery", {
	args: { filters: SearchFilters, page: Schema.Number },
	success: SearchPageData,
	error: Schema.String,
	staleTime: "0 millis",
}) {}
