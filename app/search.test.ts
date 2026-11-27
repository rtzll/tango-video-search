import { describe, expect, it } from "vite-plus/test";

import { parseSearchParams, toggleResultFilter } from "./search";

describe("parseSearchParams", () => {
	it("uses empty filters and the first page when the query is empty", () => {
		expect(parseSearchParams(new URLSearchParams())).toEqual({
			filters: {
				channel: null,
				dancer1: null,
				dancer2: null,
				event: null,
				orchestra: null,
				singer: null,
				song: null,
				year: null,
			},
			page: 1,
		});
	});

	it("reads every filter and the requested page", () => {
		const searchParams = new URLSearchParams({
			channel: "channel-1",
			dancer1: "Carlitos Espinoza",
			dancer2: "Agustina Piaggio",
			event: "Embrace Berlin Tango Festival",
			orchestra: "Juan D'Arienzo",
			page: "3",
			singer: "Alberto Echagüe",
			song: "Paciencia",
			year: "2024",
		});

		expect(parseSearchParams(searchParams)).toEqual({
			filters: {
				channel: "channel-1",
				dancer1: "Carlitos Espinoza",
				dancer2: "Agustina Piaggio",
				event: "Embrace Berlin Tango Festival",
				orchestra: "Juan D'Arienzo",
				singer: "Alberto Echagüe",
				song: "Paciencia",
				year: "2024",
			},
			page: 3,
		});
	});
});

describe("toggleResultFilter", () => {
	const emptyFilters = parseSearchParams(new URLSearchParams()).filters;

	it("fills, toggles, and limits the two dancer filters", () => {
		expect(toggleResultFilter(emptyFilters, "dancer", "Alice")).toEqual({ dancer1: "Alice" });

		const one = { ...emptyFilters, dancer1: "Alice" };
		expect(toggleResultFilter(one, "dancer", "Bob")).toEqual({ dancer2: "Bob" });

		const two = { ...one, dancer2: "Bob" };
		expect(toggleResultFilter(two, "dancer", "Carol")).toEqual({});
		expect(toggleResultFilter(two, "dancer", "alice")).toEqual({ dancer1: null });
		expect(toggleResultFilter(two, "dancer", "BOB")).toEqual({ dancer2: null });
		expect(toggleResultFilter({ ...emptyFilters, dancer2: "Bob" }, "dancer", "Alice")).toEqual({
			dancer1: "Alice",
		});
	});

	it("toggles card filters with accent-insensitive names and exact channel IDs", () => {
		const current = {
			...emptyFilters,
			orchestra: "Juan D’Arienzo",
			event: "Festival One",
			channel: "channel-1",
			year: "2024",
		};
		expect(toggleResultFilter(current, "channel", "channel-1")).toEqual({ channel: null });
		expect(toggleResultFilter(current, "channel", "CHANNEL-1")).toEqual({ channel: "CHANNEL-1" });
		expect(toggleResultFilter(current, "orchestra", "juan d'arienzo")).toEqual({ orchestra: null });
		expect(toggleResultFilter(current, "year", "2024")).toEqual({ year: null });
		expect(toggleResultFilter(current, "song", "Paciencia")).toEqual({ song: "Paciencia" });
	});
});
