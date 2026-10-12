import { redirect } from "remix/response/redirect";
import { createAction, createController } from "remix/router";

import { loadSearchPage } from "../db.server.ts";
import { routes } from "../routes.ts";
import { parseSearchParams, removeInactiveFilterSearchParams } from "../search.ts";
import { Document } from "../ui/document.tsx";
import { NotFoundPage } from "./not-found.tsx";
import { SearchPage } from "./search-page.tsx";

const PAGE_SIZE = 18;

const renderSearch = createAction(routes.home, async ({ db, render, url }) => {
	const canonicalSearchParams = removeInactiveFilterSearchParams(url.searchParams);
	if (canonicalSearchParams.toString() !== url.searchParams.toString()) {
		const query = canonicalSearchParams.toString();
		return redirect(query ? `${routes.home.href()}?${query}` : routes.home.href());
	}

	const { filters, page: requestedPage } = parseSearchParams(url.searchParams);
	const { lastUpdateTime, ...searchPage } = await loadSearchPage(db, {
		filters,
		page: requestedPage,
		pageSize: PAGE_SIZE,
	});

	const formattedLastUpdate = lastUpdateTime
		? new Intl.DateTimeFormat("en-US", {
				day: "numeric",
				month: "long",
				timeZone: "UTC",
				year: "numeric",
			}).format(lastUpdateTime)
		: "Unknown";

	return render(
		<Document title="Tango Video Search">
			<SearchPage
				filters={filters}
				formattedLastUpdate={formattedLastUpdate}
				pageSize={PAGE_SIZE}
				searchParams={url.searchParams.toString()}
				{...searchPage}
			/>
		</Document>,
	);
});

const renderNotFound = createAction(routes.notFound, ({ render }) =>
	render(
		<Document title="Tango Video Search">
			<NotFoundPage />
		</Document>,
		{ status: 404 },
	),
);

export default createController(routes, {
	actions: {
		home: renderSearch,
		homeHead: renderSearch,
		notFound: renderNotFound,
		notFoundHead: renderNotFound,
	},
});
