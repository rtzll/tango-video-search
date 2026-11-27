import { Router } from "@effect/ui";
import { HtmlServer } from "@effect/ui/html";
import { Effect, Option } from "effect";

import { App } from "../app/root";
import { AppRoute, additionalSearch } from "../app/routes";
import { parseSearchParams } from "../app/search";
import {
	SearchFacetsQuery,
	SearchQueryError,
	SearchResultsQuery,
	facetsPath,
	resultsPath,
} from "../app/search-page-data";
import { Search } from "../app/search.server";
import developmentTemplate from "../index.html?raw";

interface AppEnv {
	DB: D1Database;
	ASSETS: Fetcher;
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

const unavailable = () => new SearchQueryError({ reason: "unavailable" });

export function handleRequest(request: Request, assets: Fetcher) {
	const url = new URL(request.url);
	const isDataRequest = url.pathname === resultsPath || url.pathname === facetsPath;
	return Effect.gen(function* () {
		if (request.method !== "GET" && request.method !== "HEAD") {
			return new Response("Method Not Allowed", { status: 405, headers: { Allow: "GET, HEAD" } });
		}

		const query = parseSearchParams(url.searchParams);
		const search = yield* Search;
		if (isDataRequest) {
			const data =
				url.pathname === resultsPath
					? yield* search.results(query)
					: yield* search.facets(query.filters);
			const response = Response.json(data);
			return request.method === "HEAD" ? new Response(null, response) : response;
		}

		const route = Option.getOrElse(AppRoute.parse(url.pathname + url.search), () =>
			AppRoute.NotFound({ params: { "*": url.pathname.slice(1) } }),
		);
		const status = route._tag === "NotFound" ? 404 : 200;
		// Supply completed queries to SSR so initial HTML contains the results and
		// options even if the D1 request is slower than the renderer's budget.
		const reads =
			status === 200
				? Effect.all(
						{
							results: search.results(query),
							facets: search.facets(query.filters).pipe(
								Effect.tapError((error) => Effect.logError("Search filter options failed", error)),
								Effect.result,
							),
						},
						{ concurrency: "unbounded" },
					)
				: Effect.succeed(null);
		const [data, template] = yield* Effect.all(
			[reads, Effect.tryPromise(() => getDocument(url, assets))],
			{ concurrency: "unbounded" },
		);
		const page = yield* HtmlServer.renderToHtml(App, {
			route,
			additionalSearch: route._tag === "Search" ? additionalSearch(url.href) : "",
		}).pipe(
			Effect.provide([
				SearchResultsQuery.toLayer(() =>
					data ? Effect.succeed(data.results) : Effect.fail(unavailable()),
				),
				SearchFacetsQuery.toLayer(() =>
					data
						? Effect.mapError(Effect.fromResult(data.facets), unavailable)
						: Effect.fail(unavailable()),
				),
				Router.static({ routes: AppRoute, url: AppRoute.print(route) }),
			]),
		);
		return new Response(request.method === "HEAD" ? null : HtmlServer.document(template, page), {
			status,
			headers: { "Content-Type": "text/html; charset=utf-8" },
		});
	}).pipe(
		Effect.catchCause((cause) =>
			Effect.logError("Tango Video Search request failed", cause).pipe(
				Effect.as(
					isDataRequest
						? Response.json({ error: "The search failed." }, { status: 500 })
						: new Response("Unexpected Server Error", { status: 500 }),
				),
			),
		),
		Effect.annotateLogs({ path: url.pathname }),
	);
}

export default {
	fetch(request: Request, env: AppEnv) {
		return Effect.runPromise(
			Effect.provide(handleRequest(request, env.ASSETS), Search.layer(env.DB)),
		);
	},
} satisfies ExportedHandler<AppEnv>;
