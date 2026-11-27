import type { Renderer } from "@effect/ui";
import { BrowserRouter, HtmlHydrate } from "@effect/ui/html";
import { Effect, Layer } from "effect";

import { App, appProps } from "./root";
import { AppRoute } from "./routes";
import { type SearchFilters } from "./search";
import { fetchSearch } from "./search-client";
import {
	SearchFacetsQuery,
	SearchFacetsSnapshot,
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
	fetchSearch(searchUrl(facetsPath, filters), SearchFacetsSnapshot),
);

const appServices = Layer.mergeAll(
	BrowserRouter.layer({ routes: AppRoute }),
	resultsLayer,
	facetsLayer,
);

function parseHydrationState(raw: string): Renderer.State | undefined {
	try {
		return JSON.parse(raw) as Renderer.State;
	} catch {
		return undefined;
	}
}

const container = document.getElementById("app");
const rawState = document.getElementById("state")?.textContent;
const state = rawState ? parseHydrationState(rawState) : undefined;

if (container && state) {
	const program = Layer.launch(
		HtmlHydrate.hydrate(App, appProps, container, state).pipe(Layer.provide(appServices)),
	).pipe(
		Effect.tapCause((cause) => Effect.logError("Failed to hydrate Tango Video Search", cause)),
	);

	Effect.runFork(program);
}
