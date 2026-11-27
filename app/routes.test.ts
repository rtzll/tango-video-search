import { Router } from "@effect/ui";
import { Effect, Option } from "effect";
import { describe, expect, it } from "vite-plus/test";

import {
	AppRoute,
	SearchRoute,
	additionalSearch,
	paginationHref,
	parseSearchRoute,
	resetSearchPatch,
	searchPatch,
} from "./routes";
import { parseSearchParams } from "./search";

describe("search routes", () => {
	it("reads the same filters and page as the API, including repeated and empty values", () => {
		const query = "dancer1=Agustina+Piaggio&dancer1=Other&channel=&page=3&page=9";
		const route = Option.getOrThrow(SearchRoute.parse(`/?${query}`));
		expect(parseSearchRoute(route)).toEqual(parseSearchParams(new URLSearchParams(query)));
		expect(parseSearchRoute(route).filters.dancer1).toBe("Agustina Piaggio");
		expect(parseSearchRoute(route).page).toBe(3);
	});

	it("keeps filters and undeclared parameters in pagination hrefs", () => {
		const href = "/?orchestra=Carlos+Di+Sarli&page=2&utm_source=newsletter&tag=a&tag=b";
		const route = Option.getOrThrow(SearchRoute.parse(href));
		const extras = additionalSearch(href);
		const pageFour = new URL(paginationHref(route, 4, extras), "https://test.invalid").searchParams;
		expect(pageFour.get("orchestra")).toBe("Carlos Di Sarli");
		expect(pageFour.get("page")).toBe("4");
		expect(pageFour.get("utm_source")).toBe("newsletter");
		expect(pageFour.getAll("tag")).toEqual(["a", "b"]);
		const firstPage = new URL(paginationHref(route, 1, extras), "https://test.invalid");
		expect(firstPage.searchParams.has("page")).toBe(false);
	});

	it("changes, clears, and resets filters while preserving undeclared parameters", async () => {
		const url = "/?orchestra=Carlos+Di+Sarli&page=4&utm_source=newsletter";
		const route = Option.getOrThrow(SearchRoute.parse(url));
		await Effect.runPromise(
			Effect.gen(function* () {
				const router = yield* Router.Router;
				const getParams = () => new URL(router.location().url, "https://test.invalid").searchParams;
				yield* router.patchSearch(route, searchPatch({ event: "Tango Cazino Festival" }), {
					history: "push",
				});
				expect(getParams().get("event")).toBe("Tango Cazino Festival");
				expect(getParams().get("orchestra")).toBe("Carlos Di Sarli");
				expect(getParams().has("page")).toBe(false);

				yield* router.patchSearch(route, searchPatch({ event: null }), { history: "push" });
				expect(getParams().has("event")).toBe(false);
				expect(getParams().get("utm_source")).toBe("newsletter");

				yield* router.patchSearch(route, resetSearchPatch, { history: "push" });
				expect([...getParams()]).toEqual([["utm_source", "newsletter"]]);
			}).pipe(Effect.provide(Router.memory({ routes: AppRoute, url }))),
		);
	});
});
