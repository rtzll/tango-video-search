import { Router } from "@effect/ui";
import { Html, HtmlServer } from "@effect/ui/html";
import { HtmlLocator, HtmlPlay } from "@effect/ui/html/testing";
import { Locator, TestHost } from "@effect/ui/testing";
import { Effect, Layer } from "effect";
import { describe, expect, it, vi } from "vite-plus/test";

import { App, appProps } from "./root";
import { AppRoute } from "./routes";
import { SearchFacetsQuery, SearchResultsQuery } from "./search-page-data";

const noopHtmlHost = Layer.succeed(Html.Host, {
	blur: () => undefined,
	focus: () => undefined,
	measure: () => ({ bottom: 0, height: 0, left: 0, right: 0, top: 0, width: 0, x: 0, y: 0 }),
	requestSubmit: () => false,
	scrollIntoView: () => undefined,
	select: () => undefined,
	showPicker: () => false,
});

const sampleFacets = {
	formattedLastUpdate: "November 27, 2026",
	options: {
		channel: [{ count: 2, label: "Tango Channel", value: "ch-1" }],
		dancer1: [
			{ count: 2, label: "Agustina Piaggio", value: "Agustina Piaggio" },
			{ count: 1, label: "Carlitos Espinoza", value: "Carlitos Espinoza" },
		],
		dancer2: [
			{ count: 2, label: "Agustina Piaggio", value: "Agustina Piaggio" },
			{ count: 1, label: "Carlitos Espinoza", value: "Carlitos Espinoza" },
		],
		event: [{ count: 1, label: "Berlin Festival", value: "Berlin Festival" }],
		orchestra: [{ count: 2, label: "Juan D'Arienzo", value: "Juan D'Arienzo" }],
		singer: [{ count: 1, label: "Alberto Echagüe", value: "Alberto Echagüe" }],
		song: [{ count: 2, label: "Paciencia", value: "Paciencia" }],
		year: [{ count: 2, label: "2024", value: "2024" }],
	},
};

function makePageResults(page: number) {
	return {
		initialVideos: [
			{
				channelId: "ch-1",
				channelTitle: "Tango Channel",
				dancers: page === 1 ? ["Agustina Piaggio", "Carlitos Espinoza"] : ["Page Two Dancer"],
				event: "Berlin Festival",
				id: `video-${page}`,
				orchestra: "Juan D'Arienzo",
				singers: ["Alberto Echagüe"],
				songTitle: "Paciencia",
				title: `Performance ${page}`,
				year: 2024,
			},
		],
		page,
		totalPages: 2,
		totalVideos: 20,
	};
}

describe("SearchPage and App interactions", () => {
	it("toggles a card filter into the URL and skips refetching on visibility changes", async () => {
		const fetchResults = vi.fn(({ page }: { readonly page: number }) =>
			Effect.succeed(makePageResults(page)),
		);
		const fetchFacets = vi.fn(() => Effect.succeed(sampleFacets));

		const layers = Layer.mergeAll(
			TestHost.layer(),
			noopHtmlHost,
			Router.memory({ routes: AppRoute, url: "/" }),
			SearchResultsQuery.toLayer(fetchResults),
			SearchFacetsQuery.toLayer(fetchFacets),
		);

		await Effect.runPromise(
			Effect.gen(function* () {
				const play = yield* HtmlPlay.make(App, appProps);
				const router = yield* Router.Router;
				const host = yield* TestHost.TestHost;

				yield* play.expect(Locator.text("Agustina Piaggio")).toExist();
				expect(fetchResults).toHaveBeenCalledTimes(1);
				expect(fetchFacets).toHaveBeenCalledTimes(1);

				// Switching away to YouTube and returning should not refetch within staleTime.
				host.visibility.set(false);
				host.visibility.set(true);
				yield* TestHost.settle;
				expect(fetchResults).toHaveBeenCalledTimes(1);
				expect(fetchFacets).toHaveBeenCalledTimes(1);

				// Clicking a dancer pill pushes the filter into the URL.
				yield* play.click(HtmlLocator.role("button", { name: "Agustina Piaggio" }));
				const params = new URL(router.location().url, "https://test.invalid").searchParams;
				expect(params.get("dancer1")).toBe("Agustina Piaggio");
				expect(fetchResults).toHaveBeenCalledTimes(2);
				expect(fetchFacets).toHaveBeenCalledTimes(2);
			}).pipe(Effect.scoped, Effect.provide(layers)),
		);
	});

	it("prefetches pagination routes on link intent and serves page 2 from cache", async () => {
		const fetchResults = vi.fn(({ page }: { readonly page: number }) =>
			Effect.succeed(makePageResults(page)),
		);
		const fetchFacets = vi.fn(() => Effect.succeed(sampleFacets));

		const layers = Layer.mergeAll(
			TestHost.layer(),
			noopHtmlHost,
			Router.memory({ routes: AppRoute, url: "/" }),
			SearchResultsQuery.toLayer(fetchResults),
			SearchFacetsQuery.toLayer(fetchFacets),
		);

		await Effect.runPromise(
			Effect.gen(function* () {
				const play = yield* HtmlPlay.make(App, appProps);
				const router = yield* Router.Router;

				yield* play.expect(Locator.text("Page 1 of 2")).toExist();
				expect(fetchResults).toHaveBeenCalledTimes(1);

				// Hover/focus intent prefetches page 2 before navigation.
				yield* router.intent("/?page=2");
				yield* TestHost.settle;
				expect(fetchResults).toHaveBeenCalledTimes(2);

				// Navigating to page 2 reuses the prefetched entry without a third fetch.
				yield* router.navigate("/?page=2");
				yield* play.expect(Locator.text("Page Two Dancer")).toExist();
				expect(fetchResults).toHaveBeenCalledTimes(2);
				expect(fetchFacets).toHaveBeenCalledTimes(1);
			}).pipe(Effect.scoped, Effect.provide(layers)),
		);
	});

	it("updates undeclared query parameters in pagination links after client navigation", async () => {
		const layers = Layer.mergeAll(
			TestHost.layer(),
			noopHtmlHost,
			Router.memory({ routes: AppRoute, url: "/missing" }),
			SearchResultsQuery.toLayer(({ page }) => Effect.succeed(makePageResults(page))),
			SearchFacetsQuery.toLayer(() => Effect.succeed(sampleFacets)),
		);

		await Effect.runPromise(
			Effect.gen(function* () {
				const play = yield* HtmlPlay.make(App, appProps);
				const router = yield* Router.Router;

				yield* play.expect(Locator.text("Not found")).toExist();

				yield* router.navigate("/?utm_source=newsletter");
				yield* play.expect(Locator.text("Page 1 of 2")).toExist();

				const nextLinks = play.root.all(HtmlLocator.role("link", { name: "Next" }));
				expect(nextLinks.length).toBeGreaterThan(0);
				for (const link of nextLinks) {
					expect(link.attrs?.href).toBe("/?page=2&utm_source=newsletter");
				}
			}).pipe(Effect.scoped, Effect.provide(layers)),
		);
	});

	it("prioritizes above-the-fold thumbnails and lazy-loads offscreen cards", async () => {
		const videos = Array.from({ length: 4 }, (_, index) => ({
			...makePageResults(1).initialVideos[0],
			id: `video-${index + 1}`,
		}));
		const layers = Layer.mergeAll(
			TestHost.layer(),
			noopHtmlHost,
			Router.memory({ routes: AppRoute, url: "/" }),
			SearchResultsQuery.toLayer(() =>
				Effect.succeed({ initialVideos: videos, page: 1, totalPages: 1, totalVideos: 4 }),
			),
			SearchFacetsQuery.toLayer(() => Effect.succeed(sampleFacets)),
		);

		await Effect.runPromise(
			Effect.gen(function* () {
				const play = yield* HtmlPlay.make(App, appProps);
				const images = play.root.all(Locator.tag("img"));
				expect(images).toHaveLength(4);

				expect(images[0].attrs).toMatchObject({
					fetchpriority: "high",
					height: "360",
					width: "480",
				});
				expect(images[0].attrs?.loading).toBeUndefined();
				expect(images[1].attrs?.loading).toBeUndefined();
				expect(images[2].attrs?.loading).toBeUndefined();
				expect(images[2].attrs?.fetchpriority).toBeUndefined();
				expect(images[3].attrs).toMatchObject({
					decoding: "async",
					height: "360",
					loading: "lazy",
					width: "480",
				});
			}).pipe(Effect.scoped, Effect.provide(layers)),
		);
	});

	it("renders dynamic title, description, OpenGraph, and canonical link from active filters", async () => {
		const renderHead = (url: string) =>
			Effect.runPromise(
				HtmlServer.renderToHtml(App, appProps).pipe(
					Effect.provide([
						Router.static({ routes: AppRoute, url }),
						SearchResultsQuery.toLayer(({ page }) => Effect.succeed(makePageResults(page))),
						SearchFacetsQuery.toLayer(() => Effect.succeed(sampleFacets)),
					]),
				),
			);

		const home = await renderHead("/");
		expect(home.head).toContain("<title data-eui>Tango Video Search</title>");
		expect(home.head).toContain(
			'property="og:image" content="https://i.ytimg.com/vi/video-1/hqdefault.jpg"',
		);
		expect(home.head).toContain('rel="canonical" href="/"');

		const filtered = await renderHead(
			"/?dancer1=Agustina+Piaggio&orchestra=Juan+D%27Arienzo&channel=ch-1&page=2&utm_source=x",
		);
		expect(filtered.head).toContain(
			"<title data-eui>Agustina Piaggio · Juan D'Arienzo · Tango Channel (Page 2) — Tango Video Search</title>",
		);
		expect(filtered.head).toContain(
			'name="description" content="Browse 20 tango performances for Agustina Piaggio · Juan D\'Arienzo · Tango Channel."',
		);
		expect(filtered.head).toContain(
			'property="og:image" content="https://i.ytimg.com/vi/video-2/hqdefault.jpg"',
		);
		expect(filtered.head).toContain('rel="canonical"');
		expect(filtered.head).not.toContain("utm_source");
	});
});
