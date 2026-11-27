import { Head, Router, Subscription, UiSchema } from "@effect/ui";
import { Html, HtmlHead } from "@effect/ui/html";
import { Effect, Schema, Stream } from "effect";

import { AppRoute, additionalSearch } from "./routes";
import { SearchPage } from "./search-page";

const Message = UiSchema.TaggedEnum({
	ChangedRoute: { route: AppRoute },
	ChangedAdditionalSearch: { additionalSearch: Schema.String },
});

export const appProps = Effect.gen(function* () {
	const router = yield* Router.Router;
	const route = yield* Router.currentRoute(AppRoute);
	return {
		route,
		additionalSearch: route._tag === "Search" ? additionalSearch(router.location().url) : "",
	};
});

const watchAdditionalSearch = Subscription.make(
	"additionalSearch",
	Stream.unwrap(
		Effect.map(Router.Router, (router) =>
			router.changes.pipe(
				Stream.map((location) =>
					location.route._tag === "Search" ? additionalSearch(location.url) : "",
				),
				Stream.changes,
				Stream.map((value) => Message.ChangedAdditionalSearch({ additionalSearch: value })),
			),
		),
	),
);

const prefetchRoutes = Router.prefetch(AppRoute, {
	Search: (route) => [Router.page(SearchPage, { route, additionalSearch: "" })],
	NotFound: () => [],
});

export const App = Html.component({
	name: "App",
	props: Schema.Struct({
		route: AppRoute,
		additionalSearch: Schema.optional(Schema.String),
	}),
	model: Schema.Struct({ route: AppRoute, additionalSearch: Schema.String }),
	message: Message,
}).make({
	init: ({ props }) => ({
		route: props.route,
		additionalSearch: props.additionalSearch ?? "",
	}),
	update: {
		ChangedRoute: ($, { route }) =>
			$.model.route._tag === "Search" && route._tag === "Search"
				? $.evolve({ route }).viewTransition(["search-update"])
				: $.evolve({ route }),
		ChangedAdditionalSearch: ($, { additionalSearch: value }) =>
			$.model.additionalSearch === value ? $.model : $.evolve({ additionalSearch: value }),
	},
	subscriptions: ({ model }) => [
		Router.subscription(AppRoute, model.route, (route) => Message.ChangedRoute({ route })),
		watchAdditionalSearch,
		prefetchRoutes,
	],
	head: ({ model: { route } }) => [
		HtmlHead.lang("en"),
		...(route._tag === "NotFound" ? [Head.title("Tango Video Search")] : []),
	],
	view: (h, { route, additionalSearch: extras }) =>
		AppRoute.match(route, {
			Search: (searchRoute) =>
				SearchPage(h, { props: { route: searchRoute, additionalSearch: extras } }),
			NotFound: () =>
				h.div
					.class("p-6")
					.children(
						h.h1.class("text-2xl font-semibold").children("Not found"),
						h.p.class("text-muted mt-2 text-sm").children("The page you requested does not exist."),
						h.a.attr("href", "/").class("mt-4 inline-block underline").children("Go back home"),
					),
		}),
});
