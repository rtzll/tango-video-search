import { env } from "cloudflare:workers";
import { Deferred, Effect, Fiber, Layer } from "effect";
import { expect, it, vi } from "vite-plus/test";

import { handleRequest } from "../workers/app";
import { parseSearchParams } from "./search";
import type { SearchFacets } from "./search-page-data";
import { Search, SearchReadError } from "./search.server";

const { ASSETS: assets } = env as unknown as { ASSETS: Fetcher };
const emptyResults = { initialVideos: [], page: 1, totalPages: 1, totalVideos: 0 };
const facets = {
	formattedLastUpdate: "November 27, 2026",
	options: {
		channel: [],
		dancer1: [{ count: 1, label: "Test Dancer", value: "Test Dancer" }],
		dancer2: [],
		event: [],
		orchestra: [],
		singer: [],
		song: [],
		year: [],
	},
};

it("passes parsed filters and page to the service and reads only the requested data", async () => {
	const search = {
		results: vi.fn(() => Effect.succeed(emptyResults)),
		facets: vi.fn(() => Effect.succeed(facets)),
	};
	const request = new Request("https://example.com/api/search?year=2024&page=2");
	const response = await Effect.runPromise(
		handleRequest(request, assets).pipe(Effect.provide(Layer.succeed(Search, search))),
	);

	expect(await response.json()).toEqual(emptyResults);
	expect(search.results).toHaveBeenCalledExactlyOnceWith(
		parseSearchParams(new URLSearchParams("year=2024&page=2")),
	);
	expect(search.facets).not.toHaveBeenCalled();
});

it("waits for filter options before rendering and serializing the initial page", async () => {
	const response = await Effect.runPromise(
		Effect.gen(function* () {
			const resultsStarted = yield* Deferred.make<void>();
			const facetsStarted = yield* Deferred.make<void>();
			const ready = yield* Deferred.make<typeof SearchFacets.Type>();
			const layer = Layer.succeed(Search, {
				results: () => Deferred.succeed(resultsStarted, undefined).pipe(Effect.as(emptyResults)),
				facets: () =>
					Deferred.succeed(facetsStarted, undefined).pipe(Effect.andThen(Deferred.await(ready))),
			});
			const request = new Request("https://example.com/");
			const page = yield* Effect.forkChild(
				handleRequest(request, assets).pipe(Effect.provide(layer)),
			);
			yield* Deferred.await(resultsStarted);
			yield* Deferred.await(facetsStarted);
			expect(page.pollUnsafe()).toBeUndefined();
			yield* Deferred.succeed(ready, facets);
			return yield* Fiber.join(page);
		}),
	);

	expect(response.status).toBe(200);
	const html = await response.text();
	expect(html).toContain("No performances match these filters.");
	expect(html).toContain("Test Dancer");
});

it("returns an HTTP error when the search results read fails", async () => {
	const layer = Layer.succeed(Search, {
		results: () => new SearchReadError({ operation: "results", cause: new Error("Test failure") }),
		facets: () => Effect.succeed(facets),
	});
	const request = new Request("https://example.com/api/search");
	const response = await Effect.runPromise(
		handleRequest(request, assets).pipe(Effect.provide(layer)),
	);

	expect(response.status).toBe(500);
	expect(await response.json()).toEqual({ error: "The search failed." });
});
