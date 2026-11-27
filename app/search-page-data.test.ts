import { Schema } from "effect";
import { describe, expect, it } from "vite-plus/test";

import { SearchFacets } from "./search-page-data";

const codec = Schema.toCodecJson(SearchFacets);
const encode = Schema.encodeSync(codec);
const decode = Schema.decodeUnknownSync(codec);
const alice = { count: 3, label: "Alice", value: "Alice" };

const shared = {
	formattedLastUpdate: "November 23, 2026",
	options: {
		channel: [],
		dancer1: [alice],
		dancer2: [{ ...alice }],
		event: [],
		orchestra: [],
		singer: [],
		song: [],
		year: [],
	},
};

describe("search facet hydration", () => {
	it("stores matching dancer lists once and restores both picker lists", () => {
		const encoded = encode(shared);
		expect(encoded).not.toHaveProperty("options.dancer2");
		expect(decode(encoded)).toEqual(shared);
		expect(decode(shared)).toEqual(shared);
	});

	it("keeps separate lists when the same dancer has different counts", () => {
		const distinct = {
			...shared,
			options: { ...shared.options, dancer2: [{ ...alice, count: 1 }] },
		};
		const encoded = encode(distinct);
		expect(encoded).toHaveProperty("options.dancer2", distinct.options.dancer2);
		expect(decode(encoded)).toEqual(distinct);
	});

	it("keeps the order of each list when the options are ordered differently", () => {
		const bob = { count: 3, label: "Bob", value: "Bob" };
		const distinct = {
			...shared,
			options: { ...shared.options, dancer1: [alice, bob], dancer2: [bob, alice] },
		};
		expect(decode(encode(distinct))).toEqual(distinct);
	});
});
