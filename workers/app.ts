import { Router } from "@effect/ui";
import { HtmlServer } from "@effect/ui/html";
import { Effect, Option } from "effect";

import { createDatabase, loadSearchPage } from "../app/db.server";
import { App } from "../app/root";
import { AppRoute } from "../app/routes";
import { parseSearchParams } from "../app/search";
import { PAGE_SIZE, SearchPageQuery, searchDataPath } from "../app/search-page-data";
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

async function getSearchPage(database: D1Database, search: ReturnType<typeof parseSearchParams>) {
	const { lastUpdateTime, ...results } = await loadSearchPage(createDatabase(database), {
		...search,
		pageSize: PAGE_SIZE,
	});
	return {
		formattedLastUpdate: lastUpdateTime ? dateFormat.format(lastUpdateTime) : "Unknown",
		...results,
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
	if (!response.ok) throw new Error(`Unable to load the built HTML template (${response.status})`);
	return response.text();
}

export default {
	async fetch(request, env) {
		const url = new URL(request.url);
		const isDataRequest = url.pathname === searchDataPath;
		if (request.method !== "GET" && request.method !== "HEAD") {
			return new Response("Method Not Allowed", { status: 405, headers: { Allow: "GET, HEAD" } });
		}

		try {
			if (isDataRequest) {
				const data = await getSearchPage(env.DB, parseSearchParams(url.searchParams));
				const response = Response.json(data);
				return request.method === "HEAD" ? new Response(null, response) : response;
			}

			const route = Option.getOrElse(AppRoute.parse(url.pathname + url.search), () =>
				AppRoute.NotFound({ params: { "*": url.pathname.slice(1) } }),
			);
			const status = route._tag === "NotFound" ? 404 : 200;
			// Load from the D1 binding once and supply the result to the server-side query.
			const data =
				status === 200 ? await getSearchPage(env.DB, parseSearchParams(url.searchParams)) : null;
			const queryLayer = SearchPageQuery.toLayer(
				Effect.succeed(() => (data ? Effect.succeed(data) : Effect.fail("The search failed."))),
			);
			const render = HtmlServer.renderToHtml(App, { route }).pipe(
				Effect.provide([
					queryLayer,
					Router.static({ routes: AppRoute, url: AppRoute.print(route) }),
				]),
			);
			const [page, template] = await Promise.all([
				Effect.runPromise(render),
				getDocument(url, env.ASSETS),
			]);
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
