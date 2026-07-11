import { describe, expect, it } from "vitest";

import {
	getPageHref,
	parseSearchParams,
	toggleResultFilterSearchParams,
	updateFilterSearchParams,
} from "./search";
import { ANY_FILTER_VALUE } from "./utils/filters";

describe("parseSearchParams", () => {
	it("uses empty filters and the first page when the query is empty", () => {
		expect(parseSearchParams(new URLSearchParams())).toEqual({
			filters: {
				dancer1: ANY_FILTER_VALUE,
				dancer2: ANY_FILTER_VALUE,
				event: ANY_FILTER_VALUE,
				orchestra: ANY_FILTER_VALUE,
				singer: ANY_FILTER_VALUE,
				song: ANY_FILTER_VALUE,
			},
			page: 1,
		});
	});

	it("reads every filter and the requested page", () => {
		const searchParams = new URLSearchParams({
			dancer1: "Carlitos Espinoza",
			dancer2: "Agustina Piaggio",
			event: "Embrace Berlin Tango Festival",
			orchestra: "Juan D'Arienzo",
			page: "3",
			singer: "Alberto Echagüe",
			song: "Paciencia",
		});

		expect(parseSearchParams(searchParams)).toEqual({
			filters: {
				dancer1: "Carlitos Espinoza",
				dancer2: "Agustina Piaggio",
				event: "Embrace Berlin Tango Festival",
				orchestra: "Juan D'Arienzo",
				singer: "Alberto Echagüe",
				song: "Paciencia",
			},
			page: 3,
		});
	});
});

describe("updateFilterSearchParams", () => {
	it("sets the filter, preserves other filters, and resets pagination", () => {
		const current = new URLSearchParams({ orchestra: "Carlos Di Sarli", page: "4" });

		expect(updateFilterSearchParams(current, "event", "Tango Cazino Festival").toString()).toBe(
			"orchestra=Carlos+Di+Sarli&event=Tango+Cazino+Festival",
		);
		expect(current.toString()).toBe("orchestra=Carlos+Di+Sarli&page=4");
	});

	it("removes a cleared filter", () => {
		const current = new URLSearchParams({
			event: "Tango Cazino Festival",
			singer: "Roberto Rufino",
		});

		expect(updateFilterSearchParams(current, "event", ANY_FILTER_VALUE).toString()).toBe(
			"singer=Roberto+Rufino",
		);
	});
});

describe("getPageHref", () => {
	it("preserves filters while adding or removing the page", () => {
		const current = new URLSearchParams({ orchestra: "Carlos Di Sarli", page: "2" });

		expect(getPageHref(current, 4)).toBe("?orchestra=Carlos+Di+Sarli&page=4");
		expect(getPageHref(current, 1)).toBe("?orchestra=Carlos+Di+Sarli");
	});
});

describe("toggleResultFilterSearchParams", () => {
	it("fills, toggles, and limits the two dancer filters", () => {
		const firstDancer = toggleResultFilterSearchParams(
			new URLSearchParams({ page: "3" }),
			"dancer",
			"Alice",
		);
		expect(firstDancer.toString()).toBe("dancer1=Alice");

		const secondDancer = toggleResultFilterSearchParams(firstDancer, "dancer", "Bob");
		expect(secondDancer.toString()).toBe("dancer1=Alice&dancer2=Bob");

		const unchanged = toggleResultFilterSearchParams(secondDancer, "dancer", "Carol");
		expect(unchanged.toString()).toBe("dancer1=Alice&dancer2=Bob");

		const toggledOff = toggleResultFilterSearchParams(secondDancer, "dancer", "Alice");
		expect(toggledOff.toString()).toBe("dancer2=Bob");
	});

	it("toggles single-value card filters and resets pagination", () => {
		const selected = toggleResultFilterSearchParams(
			new URLSearchParams({ page: "3" }),
			"orchestra",
			"Orchestra One",
		);
		expect(selected.toString()).toBe("orchestra=Orchestra+One");

		const toggledOff = toggleResultFilterSearchParams(selected, "orchestra", "orchestra one");
		expect(toggledOff.toString()).toBe("");
	});
});
