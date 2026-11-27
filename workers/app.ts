import { Router } from "@effect/ui";
import { HtmlServer } from "@effect/ui/html";
import { Cause, Effect, Exit, Option } from "effect";

import { App } from "../app/root";
import { AppRoute, additionalSearch } from "../app/routes";
import { parseSearchParams } from "../app/search";
import {
	SearchFacetsQuery,
	SearchQueryError,
	SearchResultsQuery,
	encodeSearchFacetsPayload,
	facetsPath,
	resultsPath,
} from "../app/search-page-data";
import { Search } from "../app/search.server";
import developmentTemplate from "../index.html?raw";

interface AppEnv {
	DB: D1Database;
	ASSETS: Fetcher;
}

interface WorkerTracing {
	startSpan(name: string): {
		end(): void;
		setStatus(status: TracingSpanStatus): void;
	};
}

function withWorkerSpan<A, E, R>(
	tracing: WorkerTracing | undefined,
	name: string,
	effect: Effect.Effect<A, E, R>,
) {
	if (!tracing) {
		return effect;
	}
	return Effect.acquireUseRelease(
		Effect.sync(() => tracing.startSpan(name)),
		() => effect,
		(span, exit) =>
			Effect.sync(() => {
				if (Exit.isSuccess(exit)) {
					span.setStatus({ code: "ok" });
				} else if (!Cause.hasInterruptsOnly(exit.cause)) {
					span.setStatus({ code: "error" });
				}
				span.end();
			}),
	);
}

const apiCacheControl = "public, max-age=300, stale-while-revalidate=3600";
const htmlCacheControl = "public, max-age=60, stale-while-revalidate=300";

let cachedDocument: Promise<string> | undefined;

function getDocument(url: URL, assets: Fetcher) {
	if (import.meta.env.DEV) {
		return Promise.resolve(
			developmentTemplate.replace(
				"</head>",
				'<script type="module" src="/@vite/client"></script></head>',
			),
		);
	}

	if (!cachedDocument) {
		cachedDocument = assets
			.fetch(new URL("/index.html", url))
			.then((response) => {
				if (!response.ok) {
					throw new Error(`Unable to load the built HTML template (${response.status})`);
				}
				return response.text();
			})
			.catch((error) => {
				cachedDocument = undefined;
				throw error;
			});
	}
	return cachedDocument;
}

const unavailable = () => new SearchQueryError({ reason: "unavailable" });

export function handleRequest(request: Request, assets: Fetcher, tracing?: WorkerTracing) {
	const url = new URL(request.url);
	const isDataRequest = url.pathname === resultsPath || url.pathname === facetsPath;
	return Effect.gen(function* () {
		if (request.method !== "GET" && request.method !== "HEAD") {
			return new Response("Method Not Allowed", { status: 405, headers: { Allow: "GET, HEAD" } });
		}

		const query = parseSearchParams(url.searchParams);
		const search = yield* Search;
		const loadResults = () => withWorkerSpan(tracing, "search.results", search.results(query));
		const loadFacets = () => withWorkerSpan(tracing, "search.facets", search.facets(query.filters));
		if (isDataRequest) {
			const data =
				url.pathname === resultsPath
					? yield* loadResults()
					: encodeSearchFacetsPayload(yield* loadFacets());
			const response = Response.json(data, { headers: { "Cache-Control": apiCacheControl } });
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
							results: loadResults(),
							facets: loadFacets().pipe(
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
		const render = HtmlServer.renderToHtml(App, {
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
			Effect.map(
				(page) =>
					new Response(request.method === "HEAD" ? null : HtmlServer.document(template, page), {
						status,
						headers: {
							"Content-Type": "text/html; charset=utf-8",
							...(status === 200 ? { "Cache-Control": htmlCacheControl } : {}),
						},
					}),
			),
		);
		return yield* withWorkerSpan(tracing, "search.render", render);
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
	fetch(request: Request, env: AppEnv, ctx: ExecutionContext) {
		const tracing = ctx.tracing;
		const requestTracing = tracing?.getActiveSpan()?.isTraced ? tracing : undefined;
		const response = handleRequest(request, env.ASSETS, requestTracing);
		return Effect.runPromise(Effect.provide(response, Search.layer(env.DB)));
	},
} satisfies ExportedHandler<AppEnv>;
