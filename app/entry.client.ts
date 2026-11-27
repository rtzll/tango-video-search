import { Router } from "@effect/ui";
import { BrowserRouter, HtmlHydrate } from "@effect/ui/html";
import { Effect, Schema } from "effect";

import { App } from "./root";
import { AppRoute } from "./routes";
import { SearchPageData, SearchPageQuery, searchDataPath } from "./search-page-data";

const searchLayer = SearchPageQuery.toLayer(
	Effect.succeed(({ filters, page }) =>
		Effect.tryPromise({
			try: async (signal) => {
				const url = new URL(searchDataPath, location.origin);
				for (const [key, value] of Object.entries(filters)) {
					if (value !== null) url.searchParams.set(key, value);
				}
				if (page > 1) url.searchParams.set("page", String(page));
				const response = await fetch(url, { signal });
				if (!response.ok) throw new Error(`Search HTTP status ${response.status}`);
				const data: unknown = await response.json();
				return Schema.decodeUnknownSync(SearchPageData)(data);
			},
			catch: () => "The search failed.",
		}),
	),
);

const hydrate = Effect.gen(function* () {
	const container = document.getElementById("app");
	const state = document.getElementById("state")?.textContent;
	if (!container || !state) return;

	yield* HtmlHydrate.hydrateEffect(App, Router.props(AppRoute), container, JSON.parse(state));
	return yield* Effect.never;
}).pipe(Effect.scoped, Effect.provide([BrowserRouter.layer({ routes: AppRoute }), searchLayer]));

Effect.runFork(hydrate);
