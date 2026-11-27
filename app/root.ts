import { Head, Router, UiSchema } from "@effect/ui";
import { Html, HtmlHead } from "@effect/ui/html";
import { Schema } from "effect";

import { AppRoute } from "./routes";
import { SearchPage } from "./search-page";

const ChangedRoute = UiSchema.TaggedEnum({ ChangedRoute: { route: AppRoute } });

export const App = Html.component({
	name: "App",
	props: Schema.Struct({ route: AppRoute, additionalSearch: Schema.String }),
	model: Schema.Struct({ route: AppRoute }),
	message: ChangedRoute,
}).make({
	init: ({ props }) => ({ route: props.route }),
	update: (_, { route }) => ({ route }),
	subscriptions: ({ model }) => [
		Router.subscription(AppRoute, model.route, (route) => ChangedRoute.ChangedRoute({ route })),
	],
	head: ({ model: { route } }) => [
		HtmlHead.lang("en"),
		...(route._tag === "NotFound" ? [Head.title("Tango Video Search")] : []),
	],
	view: (h, { route }) =>
		AppRoute.match(route, {
			Search: (route) =>
				SearchPage(h, { props: { route, additionalSearch: h.props.additionalSearch } }),
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
