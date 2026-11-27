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
	expect(response.headers.get("Cache-Control")).toContain("max-age=");
	expect(search.results).toHaveBeenCalledExactlyOnceWith(
		parseSearchParams(new URLSearchParams("year=2024&page=2")),
	);
	expect(search.facets).not.toHaveBeenCalled();
});

it("serves compact filter options with caching headers", async () => {
	const search = {
		results: vi.fn(() => Effect.succeed(emptyResults)),
		facets: vi.fn(() => Effect.succeed(facets)),
	};
	const request = new Request("https://example.com/api/search/options?year=2024");
	const response = await Effect.runPromise(
		handleRequest(request, assets).pipe(Effect.provide(Layer.succeed(Search, search))),
	);

	expect(response.headers.get("Cache-Control")).toContain("max-age=");
	expect(await response.json()).toMatchObject({
		formattedLastUpdate: "November 27, 2026",
		options: { dancer1: [["Test Dancer", 1]] },
	});
	expect(search.facets).toHaveBeenCalledExactlyOnceWith(
		parseSearchParams(new URLSearchParams("year=2024")).filters,
	);
	expect(search.results).not.toHaveBeenCalled();
});

it("waits for filter options before rendering and serializing the initial page", async () => {
	const response = await Effect.runPromise(
		Effect.gen(function* () {
			const resultsStarted = yield* Deferred.make<void>();
			const facetsStarted = yield* Deferred.make<void>();
			const ready = yield* Deferred.make<SearchFacets>();
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

it("records and closes each request span even when the filter-options read fails", async () => {
	const events: string[] = [];
	const tracing = {
		startSpan(name: string) {
			events.push(`start:${name}`);
			return {
				setStatus({ code }: TracingSpanStatus) {
					events.push(`${code}:${name}`);
				},
				end() {
					events.push(`end:${name}`);
				},
			};
		},
	};
	const layer = Layer.succeed(Search, {
		results: () => Effect.succeed(emptyResults),
		facets: () => new SearchReadError({ operation: "facets", cause: new Error("Test failure") }),
	});
	const request = new Request("https://example.com/");
	const response = await Effect.runPromise(
		handleRequest(request, assets, tracing).pipe(Effect.provide(layer)),
	);

	expect(response.status).toBe(200);
	expect(events).toHaveLength(9);
	expect(events).toEqual(
		expect.arrayContaining([
			"start:search.results",
			"ok:search.results",
			"end:search.results",
			"start:search.facets",
			"error:search.facets",
			"end:search.facets",
		]),
	);
	expect(events.slice(-3)).toEqual([
		"start:search.render",
		"ok:search.render",
		"end:search.render",
	]);
});
