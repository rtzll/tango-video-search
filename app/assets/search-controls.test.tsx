import { renderToStream } from "remix/component/server";
import { describe, expect, it } from "vitest";

import type { SearchFilters, SearchOptions } from "../search.ts";
import { SearchControls, SearchControlsEntryId } from "./search-controls.tsx";

const emptyFilters: SearchFilters = {
	channel: null,
	dancer1: null,
	dancer2: null,
	event: null,
	orchestra: null,
	singer: null,
	song: null,
	year: null,
};

const emptyOptions: SearchOptions = {
	channel: [{ count: 9, label: "Channel One", value: "channel-1" }],
	dancer1: [],
	dancer2: [],
	event: [],
	orchestra: [],
	singer: [],
	song: [],
	year: [],
};

describe("search controls server rendering", () => {
	it("server-renders the enhanced controls with a native GET fallback", async () => {
		const stream = renderToStream(
			<SearchControls filters={emptyFilters} options={emptyOptions} searchParams="" />,
			{
				async resolveClientEntry(entryId) {
					expect(entryId).toBe(SearchControlsEntryId);
					return {
						exportName: SearchControlsEntryId,
						href: "/assets/entry.js",
					};
				},
			},
		);
		const html = await new Response(stream).text();

		expect(html).toContain('aria-label="Select first dancer"');
		expect(html).toContain('data-enhanced-search=""');
		expect(html).toContain("<noscript>");
		expect(html).toContain('<form action="/" method="get"');
		expect(html).toContain('aria-label="Choose performance details"');
		expect(html).toContain('<select name="dancer1">');
		expect(html).toContain('<select name="channel">');
		expect(html).toContain(">Apply filters</button>");
	});

	it("selects channel IDs by exact value in the native fallback", async () => {
		const filters = { ...emptyFilters, channel: "ab-c" };
		const options = {
			...emptyOptions,
			channel: [
				{ count: 2, label: "Normalized collision", value: "Ab_C" },
				{ count: 1, label: "Exact channel", value: "ab-c" },
			],
		};
		const stream = renderToStream(
			<SearchControls filters={filters} options={options} searchParams="channel=ab-c" />,
			{
				async resolveClientEntry() {
					return {
						exportName: SearchControlsEntryId,
						href: "/assets/entry.js",
					};
				},
			},
		);
		const html = await new Response(stream).text();

		expect(html).toContain('<option value="Ab_C">Normalized collision (2)</option>');
		expect(html).toMatch(
			/<option value="ab-c" selected(?:=""|="selected")?>Exact channel \(1\)<\/option>/,
		);
	});
});
