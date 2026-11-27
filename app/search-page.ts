import { Command, Head, Router, UiSchema } from "@effect/ui";
import { Html, HtmlHead } from "@effect/ui/html";
import { Option, Schema } from "effect";
import { AsyncResult } from "effect/reactivity";

import { Icon } from "./components/icons";
import { ResultsNavigation } from "./components/results-navigation";
import { SearchControls } from "./components/search-controls";
import { VideoCard } from "./components/video-card";
import { AppRoute, routeSearchParams, SearchRoute } from "./routes";
import {
	getPageHref,
	parseSearchParams,
	toggleResultFilterSearchParams,
	updateFilterSearchParams,
} from "./search";
import { PAGE_SIZE, SearchPageQuery } from "./search-page-data";

const Message = UiSchema.TaggedEnum({
	ChangedFilter: {
		key: Schema.Literals([
			"channel",
			"dancer1",
			"dancer2",
			"event",
			"orchestra",
			"singer",
			"song",
			"year",
		]),
		value: Schema.NullOr(Schema.String),
	},
	ToggledCardFilter: {
		key: Schema.Literals(["channel", "dancer", "event", "orchestra", "singer", "song", "year"]),
		value: Schema.String,
	},
	ResetFilters: {},
});

export const SearchPage = Html.component({
	name: "SearchPage",
	props: Schema.Struct({ route: SearchRoute }),
	model: Schema.Struct({}),
	message: Message,
	queries: {
		results: {
			query: SearchPageQuery,
			args: ({ props }) => parseSearchParams(routeSearchParams(props.route)),
		},
	},
}).make({
	init: () => ({}),
	update: ($, message) => {
		const current = routeSearchParams($.props.route);
		const search = Message.match(message, {
			ChangedFilter: ({ key, value }) => updateFilterSearchParams(current, key, value),
			ToggledCardFilter: ({ key, value }) => toggleResultFilterSearchParams(current, key, value),
			ResetFilters: () => new URLSearchParams(),
		});
		const route = Option.getOrThrow(AppRoute.parse(`/?${search}`));
		return $.run(Router.push(AppRoute, route).pipe(Command.asNoop));
	},
	head: () => [
		Head.title("Tango Video Search"),
		HtmlHead.meta({ name: "description", content: "A different way to find tango videos." }),
	],
	view: (h) => {
		const search = routeSearchParams(h.props.route);
		const { filters } = parseSearchParams(search);
		return AsyncResult.match(h.queries.results, {
			onInitial: () =>
				h.p.class("text-muted p-6").attr("role", "status").children("Loading performances…"),
			onFailure: () =>
				h.p.class("text-muted p-6").attr("role", "alert").children("The search failed."),
			onSuccess: ({ value, waiting }) => {
				const { initialVideos, formattedLastUpdate, options, page, totalPages, totalVideos } =
					value;
				const startIndex = totalVideos === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
				const endIndex = Math.min(page * PAGE_SIZE, totalVideos);
				const resultText =
					totalVideos === 0
						? "No performances match these filters."
						: `Showing ${startIndex}–${endIndex} of ${totalVideos.toLocaleString("en-US")} performances`;
				const navigation = {
					getPageHref: (nextPage: number) => getPageHref(search, nextPage),
					page,
					resultText,
					totalPages,
				};

				return h.div.class("mx-auto flex min-h-screen max-w-350 flex-col gap-6 p-6").children(
					h.div.class("flex flex-col gap-3").children(
						h.div(
							SearchControls(h, {
								filters,
								onFilterChange: (key, value) => Message.ChangedFilter({ key, value }),
								onReset: Message.ResetFilters(),
								options,
							}),
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
								h.div.class("grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3").children(
									initialVideos.map((video) =>
										VideoCard(h, {
											video,
											filters,
											onFilterClick: (key, value) => Message.ToggledCardFilter({ key, value }),
										}),
									),
								),
								totalVideos > 0 &&
									ResultsNavigation(h, { ...navigation, ariaLabel: "Results pages, bottom" }),
							),
					),
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
					),
				);
			},
		});
	},
});
