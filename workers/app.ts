import { Router } from "@effect/ui";
import { HtmlServer } from "@effect/ui/html";
import { Effect, Option } from "effect";

import { createDatabase, loadSearchFacets, loadSearchResults } from "../app/db.server";
import { App } from "../app/root";
import { AppRoute, additionalSearch } from "../app/routes";
import { parseSearchParams, type SearchFilters } from "../app/search";
import {
	PAGE_SIZE,
	SearchFacetsQuery,
	SearchResultsQuery,
	facetsPath,
	resultsPath,
} from "../app/search-page-data";
import developmentTemplate from "../index.html?raw";

interface AppEnv {
	DB: D1Database;
	ASSETS: Fetcher;
}

const dateFormat = new Intl.DateTimeFormat("en-US", {
	day: "numeric",
	month: "long",
	timeZone: "UTC",
	year: "numeric",
});

async function getFacets(db: ReturnType<typeof createDatabase>, filters: SearchFilters) {
	const { lastUpdateTime, options } = await loadSearchFacets(db, filters);
	return {
		formattedLastUpdate: lastUpdateTime ? dateFormat.format(lastUpdateTime) : "Unknown",
		options,
	};
}

async function getDocument(url: URL, assets: Fetcher) {
	if (import.meta.env.DEV) {
		return developmentTemplate.replace(
			"</head>",
			'<script type="module" src="/@vite/client"></script></head>',
		);
	}

	const response = await assets.fetch(new URL("/index.html", url));
	if (!response.ok) {
		throw new Error(`Unable to load the built HTML template (${response.status})`);
	}
	return response.text();
}

export default {
	async fetch(request, env) {
		const url = new URL(request.url);
		const isDataRequest = url.pathname === resultsPath || url.pathname === facetsPath;
		if (request.method !== "GET" && request.method !== "HEAD") {
			return new Response("Method Not Allowed", { status: 405, headers: { Allow: "GET, HEAD" } });
		}

		try {
			const search = parseSearchParams(url.searchParams);
			const db = createDatabase(env.DB);
			const loadResults = () => loadSearchResults(db, { ...search, pageSize: PAGE_SIZE });
			const loadFacets = () => getFacets(db, search.filters);
			if (isDataRequest) {
				const data = await (url.pathname === resultsPath ? loadResults() : loadFacets());
				const response = Response.json(data);
				return request.method === "HEAD" ? new Response(null, response) : response;
			}

			const route = Option.getOrElse(AppRoute.parse(url.pathname + url.search), () =>
				AppRoute.NotFound({ params: { "*": url.pathname.slice(1) } }),
			);
			const status = route._tag === "NotFound" ? 404 : 200;
			// Supply completed queries to SSR so initial HTML contains the results and
			// options even if the D1 request is slower than the renderer's budget.
			const [data, template] = await Promise.all([
				status === 200 ? Promise.all([loadResults(), loadFacets()]) : null,
				getDocument(url, env.ASSETS),
			]);
			const render = HtmlServer.renderToHtml(App, {
				route,
				additionalSearch: route._tag === "Search" ? additionalSearch(url.href) : "",
			}).pipe(
				Effect.provide([
					SearchResultsQuery.toLayer(() =>
						data ? Effect.succeed(data[0]) : Effect.fail("The search failed."),
					),
					SearchFacetsQuery.toLayer(() =>
						data ? Effect.succeed(data[1]) : Effect.fail("The search failed."),
					),
					Router.static({ routes: AppRoute, url: AppRoute.print(route) }),
				]),
			);
			const page = await Effect.runPromise(render);
			return new Response(request.method === "HEAD" ? null : HtmlServer.document(template, page), {
				status,
				headers: { "Content-Type": "text/html; charset=utf-8" },
			});
		} catch (error) {
			console.error("Tango Video Search request failed", { path: url.pathname, error });
			return isDataRequest
				? Response.json({ error: "The search failed." }, { status: 500 })
				: new Response("Unexpected Server Error", { status: 500 });
		}
	},
} satisfies ExportedHandler<AppEnv>;
