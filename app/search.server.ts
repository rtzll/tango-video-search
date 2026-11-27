import { Context, Data, Effect, Layer } from "effect";

import { createDatabase, loadSearchFacets, loadSearchResults } from "./db.server";
import type { SearchFilters } from "./search";
import { PAGE_SIZE, type SearchFacets, type SearchResults } from "./search-page-data";

export class SearchReadError extends Data.TaggedError("SearchReadError")<{
	operation: "results" | "facets";
	cause: unknown;
}> {}

type SearchInput = { filters: SearchFilters; page: number };

const dateFormat = new Intl.DateTimeFormat("en-US", {
	day: "numeric",
	month: "long",
	timeZone: "UTC",
	year: "numeric",
});

function readSearch<A>(operation: SearchReadError["operation"], read: () => Promise<A>) {
	return Effect.tryPromise({
		try: read,
		catch: (cause) => new SearchReadError({ operation, cause }),
	});
}

export class Search extends Context.Service<
	Search,
	{
		readonly results: (
			input: SearchInput,
		) => Effect.Effect<typeof SearchResults.Type, SearchReadError>;
		readonly facets: (filters: SearchFilters) => Effect.Effect<SearchFacets, SearchReadError>;
	}
>()("app/Search") {
	static layer(database: D1Database) {
		return Layer.sync(Search, () => {
			const db = createDatabase(database);
			return {
				results: (input) =>
					readSearch("results", () => loadSearchResults(db, { ...input, pageSize: PAGE_SIZE })),
				facets: (filters) =>
					readSearch("facets", async () => {
						const { lastUpdateTime, options } = await loadSearchFacets(db, filters);
						return {
							formattedLastUpdate: lastUpdateTime ? dateFormat.format(lastUpdateTime) : "Unknown",
							options,
						};
					}),
			};
		});
	}
}
