import { Command, Component, Head, Router, UiSchema } from "@effect/ui";
import { Html, HtmlHead } from "@effect/ui/html";
import { Effect, Schema } from "effect";
import { AsyncResult } from "effect/reactivity";

import { Icon } from "./components/icons";
import { ResultsNavigation } from "./components/results-navigation";
import { SearchControls } from "./components/search-controls";
import { type ThumbnailPriority, VideoCard } from "./components/video-card";
import {
	AppRoute,
	SearchRoute,
	paginationHref,
	parseSearchRoute,
	resetSearchPatch,
	searchPatch,
} from "./routes";
import {
	FilterKey,
	ResultFilter,
	SearchFilters,
	type SearchOptions,
	type SearchParamKey,
	type SearchVideo,
	filterKeys,
	toggleResultFilter,
} from "./search";
import { PAGE_SIZE, SearchFacetsQuery, SearchResultsQuery } from "./search-page-data";

const Message = UiSchema.TaggedEnum({
	ChangedFilter: { key: FilterKey, value: Schema.NullOr(Schema.String) },
	ToggledCardFilter: { key: ResultFilter, value: Schema.String },
	ResetFilters: {},
	RetriedResults: {},
	RetriedFacets: {},
});
type PageMessage = typeof Message.Type;

const RetrySearchResults = Command.make(
	"RetrySearchResults",
	{ args: { filters: SearchFilters, page: Schema.Number } },
	(args) => SearchResultsQuery.invalidate(args).pipe(Effect.as(Component.noop)),
);

const RetrySearchFacets = Command.make(
	"RetrySearchFacets",
	{ args: { filters: SearchFilters } },
	(args) => SearchFacetsQuery.invalidate(args).pipe(Effect.as(Component.noop)),
);

const retryButtonClass =
	"border-border hover:bg-accent-soft text-accent-text inline-flex cursor-pointer items-center rounded-sm border px-2 py-0.5 text-xs";

const toggleCardFilter = (key: ResultFilter, value: string) =>
	Message.ToggledCardFilter({ key, value });

const renderVideoCard = (
	h: Html.H<PageMessage>,
	video: SearchVideo,
	imagePriority: ThumbnailPriority,
	channel: string | null,
	dancer1: string | null,
	dancer2: string | null,
	event: string | null,
	orchestra: string | null,
	singer: string | null,
	song: string | null,
	year: string | null,
) =>
	VideoCard(h, {
		video,
		imagePriority,
		filters: { channel, dancer1, dancer2, event, orchestra, singer, song, year },
		onFilterClick: toggleCardFilter,
	});

const renderFooter = (h: Html.H<PageMessage>, formattedLastUpdate: string) =>
	h.div.class("mt-auto pt-4").children(
		h.div.class("flex items-baseline justify-between flex-wrap").children(
			h.span.class("text-muted text-xs").children(`Data refreshed: ${formattedLastUpdate}`),
			h.a
				.attrs({
					href: "https://github.com/rtzll/tango-video-search",
					target: "_blank",
					rel: "noopener noreferrer",
				})
				.class("text-muted inline-flex items-center gap-1 text-xs hover:underline")
				.children("Source code", Icon(h, "GitHubLogo", 12)),
		),
	);

const defaultTitle = "Tango Video Search";
const defaultDescription = "A different way to find tango videos.";
const canonicalOrigin = "https://tvs.christianrotzoll.com";

function summarizeFilters(
	filters: SearchFilters,
	options: SearchOptions | undefined,
	firstVideo: SearchVideo | undefined,
) {
	const dancers = [filters.dancer1, filters.dancer2].filter(
		(value): value is string => value !== null,
	);
	const channelLabel =
		filters.channel === null
			? null
			: (options?.channel.find((option) => option.value === filters.channel)?.label ??
				(firstVideo?.channelId === filters.channel ? firstVideo.channelTitle : filters.channel));

	return [
		dancers.length > 0 ? dancers.join(" & ") : null,
		filters.song,
		filters.orchestra,
		filters.singer,
		filters.event,
		filters.year,
		channelLabel,
	]
		.filter((value): value is string => value !== null)
		.join(" · ");
}

function canonicalSearchHref(route: typeof SearchRoute.Type, filters: SearchFilters, page: number) {
	const search: Partial<Record<SearchParamKey, readonly string[]>> = {};
	for (const key of filterKeys) {
		const value = filters[key];
		if (value !== null) {
			search[key] = [value];
		}
	}
	if (page > 1) {
		search.page = [String(page)];
	}
	return new URL(SearchRoute.print({ ...route, search }), canonicalOrigin).href;
}

const emptyOptions: SearchOptions = {
	channel: [],
	dancer1: [],
	dancer2: [],
	event: [],
	orchestra: [],
	singer: [],
	song: [],
	year: [],
};

export const SearchPage = Html.component({
	name: "SearchPage",
	props: Schema.Struct({ route: SearchRoute, additionalSearch: Schema.String }),
	model: Schema.Struct({}),
	message: Message,
	// Filter navigation keeps this page mounted. Its URL and query cache already hold the state.
	restore: false,
	queries: {
		facets: {
			query: SearchFacetsQuery,
			args: ({ props }) => ({ filters: parseSearchRoute(props.route).filters }),
		},
		results: {
			query: SearchResultsQuery,
			args: ({ props }) => parseSearchRoute(props.route),
		},
	},
}).make({
	init: () => ({}),
	update: ($, message) => {
		const { route } = $.props;
		const { filters, page } = parseSearchRoute(route);
		const navigate = (patch: ReturnType<typeof searchPatch>) =>
			$.run(
				Router.patchSearch(AppRoute, route, patch, { history: "push", scroll: true }).pipe(
					Command.asNoop,
				),
			);
		return Message.match(message, {
			ChangedFilter: ({ key, value }) => navigate(searchPatch({ [key]: value })),
			ToggledCardFilter: ({ key, value }) =>
				navigate(searchPatch(toggleResultFilter(filters, key, value))),
			ResetFilters: () => navigate(resetSearchPatch),
			RetriedResults: () => $.run(RetrySearchResults.make({ filters, page })),
			RetriedFacets: () => $.run(RetrySearchFacets.make({ filters })),
		});
	},
	head: ({ props, queries }) => {
		const { route } = props;
		const { filters, page } = parseSearchRoute(route);
		const facets = AsyncResult.isSuccess(queries.facets) ? queries.facets.value : undefined;
		const results = AsyncResult.isSuccess(queries.results) ? queries.results.value : undefined;
		const firstVideo = results?.initialVideos[0];
		const summary = summarizeFilters(filters, facets?.options, firstVideo);
		const title = summary
			? page > 1
				? `${summary} (Page ${page}) — ${defaultTitle}`
				: `${summary} — ${defaultTitle}`
			: page > 1
				? `Page ${page} — ${defaultTitle}`
				: defaultTitle;
		const description = summary
			? results === undefined
				? `Browse tango performances for ${summary}.`
				: results.totalVideos === 0
					? `No tango performances matching ${summary}.`
					: `Browse ${results.totalVideos.toLocaleString("en-US")} tango ${results.totalVideos === 1 ? "performance" : "performances"} for ${summary}.`
			: defaultDescription;
		const entries = [
			Head.title(title),
			HtmlHead.meta({ name: "description", content: description }),
			HtmlHead.meta({ property: "og:type", content: "website" }),
			HtmlHead.meta({ property: "og:title", content: title }),
			HtmlHead.meta({ property: "og:description", content: description }),
			HtmlHead.link({ rel: "canonical", href: canonicalSearchHref(route, filters, page) }),
		];
		if (firstVideo) {
			entries.push(
				HtmlHead.meta({
					property: "og:image",
					content: `https://i.ytimg.com/vi/${firstVideo.id}/hqdefault.jpg`,
				}),
				HtmlHead.meta({ name: "twitter:card", content: "summary_large_image" }),
			);
		}
		return entries;
	},
	view: (h) => {
		const { route, additionalSearch } = h.props;
		const { filters } = parseSearchRoute(route);
		const facets = AsyncResult.isSuccess(h.queries.facets) ? h.queries.facets.value : undefined;
		const results = AsyncResult.isSuccess(h.queries.results) ? h.queries.results.value : undefined;
		const { waiting } = h.queries.results;

		const navigation = results && {
			getPageHref: (page: number) => paginationHref(route, page, additionalSearch),
			page: results.page,
			resultText:
				results.totalVideos === 0
					? "No performances match these filters."
					: `Showing ${(results.page - 1) * PAGE_SIZE + 1}–${Math.min(results.page * PAGE_SIZE, results.totalVideos)} of ${results.totalVideos.toLocaleString("en-US")} performances`,
			totalPages: results.totalPages,
		};

		const controls = SearchControls(h, {
			filters,
			onFilterChange: (key, value) => Message.ChangedFilter({ key, value }),
			onReset: Message.ResetFilters(),
			options: facets?.options ?? emptyOptions,
		});
		const resultsView = AsyncResult.match(h.queries.results, {
			onInitial: () =>
				h.p.class("text-muted text-sm").attr("role", "status").children("Loading performances…"),
			onFailure: () =>
				h.div
					.class("text-muted flex items-center gap-3 text-sm")
					.attr("role", "alert")
					.children(
						h.span("The search failed."),
						h.button
							.attrs({ type: "button", "aria-label": "Retry search" })
							.class(retryButtonClass)
							.on("click", Message.RetriedResults())
							.children("Retry"),
					),
			onSuccess: ({ value }) =>
				h.div
					.class("grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3")
					.children(
						value.initialVideos.map((video, index) =>
							h.lazy(
								renderVideoCard,
								video,
								index === 0 ? "high" : index < 3 ? "eager" : "lazy",
								filters.channel,
								filters.dancer1,
								filters.dancer2,
								filters.event,
								filters.orchestra,
								filters.singer,
								filters.song,
								filters.year,
							),
						),
					),
		});

		return h.div.class("mx-auto flex min-h-screen max-w-350 flex-col gap-6 p-6").children(
			h.div.class("flex flex-col gap-3").children(
				h.div(
					controls,
					AsyncResult.isFailure(h.queries.facets) &&
						h.div
							.class("text-muted mt-2 flex items-center gap-3 text-sm")
							.attr("role", "alert")
							.children(
								h.span("Filter options could not be loaded."),
								h.button
									.attrs({ type: "button", "aria-label": "Retry loading filter options" })
									.class(retryButtonClass)
									.on("click", Message.RetriedFacets())
									.children("Retry"),
							),
					navigation &&
						h.div.class("mt-4 sm:mt-2").children(
							ResultsNavigation(h, {
								...navigation,
								announce: true,
								ariaLabel: "Results pages, top",
							}),
						),
				),
				h.div
					.attr("aria-busy", String(waiting))
					.class(
						"flex flex-col gap-3 transition-opacity duration-200",
						waiting && "opacity-40 delay-150",
					)
					.children(
						resultsView,
						navigation &&
							results.totalVideos > 0 &&
							ResultsNavigation(h, { ...navigation, ariaLabel: "Results pages, bottom" }),
					),
			),
			h.lazy(renderFooter, facets?.formattedLastUpdate ?? "Unknown"),
		);
	},
});
