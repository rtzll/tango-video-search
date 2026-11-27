import { Route } from "@effect/ui";
import { Schema } from "effect";

import { filterKeys, type FilterChanges, type SearchParamKey, readSearch } from "./search";

// Repeated values are valid in bookmarked URLs. Search uses the first one.
const SearchParam = Schema.optional(Schema.Array(Schema.String));
const filterFields = Object.fromEntries(filterKeys.map((key) => [key, SearchParam])) as Record<
	(typeof filterKeys)[number],
	typeof SearchParam
>;

export const AppRoute = Route.union({
	Search: Route.make("/", { search: { ...filterFields, page: SearchParam } }),
	NotFound: Route.make("/*"),
});

export const SearchRoute = AppRoute.subset(["Search"]);

type SearchRoute = typeof SearchRoute.Type;
type SearchPatch = Partial<Record<SearchParamKey, readonly string[] | undefined>>;
const knownParams = new Set<string>([...filterKeys, "page"]);

const parsedSearchRoutes = new WeakMap<SearchRoute, ReturnType<typeof readSearch>>();

export function parseSearchRoute(route: SearchRoute) {
	let parsed = parsedSearchRoutes.get(route);
	if (parsed === undefined) {
		parsed = readSearch((key) => route.search[key]?.[0]);
		parsedSearchRoutes.set(route, parsed);
	}
	return parsed;
}

export function searchPatch(changes: FilterChanges): SearchPatch {
	const patch: SearchPatch = { page: undefined };
	for (const key of filterKeys) {
		const value = changes[key];
		if (value !== undefined) {
			patch[key] = value === null ? undefined : [value];
		}
	}
	return patch;
}

export const resetSearchPatch: SearchPatch = {
	...Object.fromEntries(filterKeys.map((key) => [key, undefined])),
	page: undefined,
};

// The router preserves undeclared parameters in patchSearch. Carry them into
// pagination hrefs as well so opening one in a new tab gives the same URL.
export function additionalSearch(url: string) {
	const params = new URL(url, "https://search.invalid").searchParams;
	return new URLSearchParams([...params].filter(([key]) => !knownParams.has(key))).toString();
}

export function paginationHref(route: SearchRoute, page: number, extras: string) {
	const search = { ...route.search };
	if (page <= 1) {
		delete search.page;
	} else {
		search.page = [String(page)];
	}

	const href = SearchRoute.print({ ...route, search });
	return extras ? `${href}${href.includes("?") ? "&" : "?"}${extras}` : href;
}
