import { Router } from "@effect/ui";
import { HtmlServer } from "@effect/ui/html";
import { Cause, Effect, Equal, Exit, Layer, Option, Tracer } from "effect";

import { App, appProps } from "../app/root";
import { AppRoute } from "../app/routes";
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

export interface WorkerTracing {
	startSpan(name: string): {
		end(): void;
		setStatus(status: TracingSpanStatus): void;
	};
}

export function workerTracerLayer(tracing: WorkerTracing) {
	return Layer.succeed(
		Tracer.Tracer,
		Tracer.make({
			span(options) {
				const native = new Tracer.NativeSpan(options);
				const workerSpan = tracing.startSpan(options.name);
				const end = native.end.bind(native);
				native.end = (endTime, exit) => {
					end(endTime, exit);
					if (Exit.isSuccess(exit)) {
						workerSpan.setStatus({ code: "ok" });
					} else if (!Cause.hasInterruptsOnly(exit.cause)) {
						workerSpan.setStatus({ code: "error" });
					}
					workerSpan.end();
				};
				return native;
			},
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

export function handleRequest(request: Request, assets: Fetcher) {
	const url = new URL(request.url);
	const isDataRequest = url.pathname === resultsPath || url.pathname === facetsPath;
	return Effect.gen(function* () {
		if (request.method !== "GET" && request.method !== "HEAD") {
			return new Response("Method Not Allowed", { status: 405, headers: { Allow: "GET, HEAD" } });
		}

		const query = parseSearchParams(url.searchParams);
		const search = yield* Search;
		const loadResults = (input = query) =>
			search.results(input).pipe(Effect.withSpan("search.results"));
		const loadFacets = (filters = query.filters) =>
			search.facets(filters).pipe(Effect.withSpan("search.facets"));
		if (isDataRequest) {
			const data =
				url.pathname === resultsPath
					? yield* loadResults()
					: encodeSearchFacetsPayload(yield* loadFacets());
			const response = Response.json(data, { headers: { "Cache-Control": apiCacheControl } });
			return request.method === "HEAD" ? new Response(null, response) : response;
		}

		const requestPath = url.pathname + url.search;
		const resolved = AppRoute.resolve(requestPath);
		if (Option.isNone(resolved)) {
			return new Response("Not Found", { status: 404 });
		}
		const { invalid, notFound, redirected, route } = resolved.value;
		if (redirected || invalid.length > 0) {
			const target = new URL(AppRoute.print(route), url);
			return Response.redirect(target, invalid.length > 0 ? 302 : 301);
		}
		const status = notFound ? 404 : 200;
		// Supply completed queries to SSR so initial HTML contains the results and
		// options even if the D1 request is slower than the renderer's budget, while
		// returning HTTP 500 when the primary results read fails.
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
		const render = HtmlServer.renderToHtml(App, appProps).pipe(
			Effect.provide([
				SearchResultsQuery.toLayer((args) =>
					data && Equal.equals(args, query)
						? Effect.succeed(data.results)
						: Effect.mapError(loadResults(args), unavailable),
				),
				SearchFacetsQuery.toLayer((args) =>
					data && Equal.equals(args.filters, query.filters)
						? Effect.mapError(Effect.fromResult(data.facets), unavailable)
						: Effect.mapError(loadFacets(args.filters), unavailable),
				),
				Router.static({ routes: AppRoute, url: requestPath }),
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
			Effect.withSpan("search.render"),
		);
		return yield* render;
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
		const services = requestTracing
			? Layer.merge(Search.layer(env.DB), workerTracerLayer(requestTracing))
			: Search.layer(env.DB);
		return Effect.runPromise(Effect.provide(handleRequest(request, env.ASSETS), services));
	},
} satisfies ExportedHandler<AppEnv>;
