import { Router } from "@effect/ui";
import { BrowserRouter, HtmlHydrate } from "@effect/ui/html";
import { Effect, Schema } from "effect";

import { App } from "./root";
import { AppRoute, additionalSearch } from "./routes";
import { type SearchFilters } from "./search";
import {
	SearchFacets,
	SearchFacetsQuery,
	SearchResults,
	SearchResultsQuery,
	facetsPath,
	resultsPath,
} from "./search-page-data";

function fetchSearch<A>(
	path: string,
	schema: Schema.Codec<A, unknown>,
	filters: SearchFilters,
	page = 1,
) {
	return Effect.tryPromise({
		try: async (signal) => {
			const url = new URL(path, location.origin);
			for (const [key, value] of Object.entries(filters)) {
				if (value !== null) {
					url.searchParams.set(key, value);
				}
			}
			if (page > 1) {
				url.searchParams.set("page", String(page));
			}

			const response = await fetch(url, { signal });
			if (!response.ok) {
				throw new Error(`Search HTTP status ${response.status}`);
			}
			return Schema.decodeUnknownSync(schema)(await response.json());
		},
		catch: () => "The search failed.",
	});
}

const resultsLayer = SearchResultsQuery.toLayer(({ filters, page }) =>
	fetchSearch(resultsPath, SearchResults, filters, page),
);
const facetsLayer = SearchFacetsQuery.toLayer(({ filters }) =>
	fetchSearch(facetsPath, SearchFacets, filters),
);

const hydrate = Effect.gen(function* () {
	const container = document.getElementById("app");
	const state = document.getElementById("state")?.textContent;
	if (!container || !state) {
		return;
	}

	const props = Effect.map(Router.props(AppRoute), (props) => ({
		...props,
		additionalSearch: props.route._tag === "Search" ? additionalSearch(location.href) : "",
	}));
	yield* HtmlHydrate.hydrateEffect(App, props, container, JSON.parse(state));
	return yield* Effect.never;
}).pipe(
	Effect.scoped,
	Effect.provide([BrowserRouter.layer({ routes: AppRoute }), resultsLayer, facetsLayer]),
);

Effect.runFork(hydrate);
