import { Router } from "@effect/ui";
import { BrowserRouter, HtmlHydrate } from "@effect/ui/html";
import { Effect } from "effect";

import { App } from "./root";
import { AppRoute, additionalSearch } from "./routes";
import { type SearchFilters } from "./search";
import { fetchSearch } from "./search-client";
import {
	SearchFacets,
	SearchFacetsQuery,
	SearchResults,
	SearchResultsQuery,
	facetsPath,
	resultsPath,
} from "./search-page-data";

function searchUrl(path: string, filters: SearchFilters, page = 1) {
	const url = new URL(path, location.origin);
	for (const [key, value] of Object.entries(filters)) {
		if (value !== null) {
			url.searchParams.set(key, value);
		}
	}
	if (page > 1) {
		url.searchParams.set("page", String(page));
	}
	return url;
}

const resultsLayer = SearchResultsQuery.toLayer(({ filters, page }) =>
	fetchSearch(searchUrl(resultsPath, filters, page), SearchResults),
);
const facetsLayer = SearchFacetsQuery.toLayer(({ filters }) =>
	fetchSearch(searchUrl(facetsPath, filters), SearchFacets),
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
