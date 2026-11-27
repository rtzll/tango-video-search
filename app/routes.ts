import { Route } from "@effect/ui";
import { Schema } from "effect";

const SearchParam = Schema.optional(Schema.Array(Schema.String));

export const AppRoute = Route.union({
	Search: Route.make("/", {
		search: {
			channel: SearchParam,
			dancer1: SearchParam,
			dancer2: SearchParam,
			event: SearchParam,
			orchestra: SearchParam,
			singer: SearchParam,
			song: SearchParam,
			year: SearchParam,
			page: SearchParam,
		},
	}),
	NotFound: Route.make("/*"),
});

export const SearchRoute = AppRoute.subset(["Search"]);

export function routeSearchParams(route: typeof SearchRoute.Type) {
	return new URLSearchParams(SearchRoute.print(route).split("?")[1]);
}
