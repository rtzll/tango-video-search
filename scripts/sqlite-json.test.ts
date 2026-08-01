import { describe, expect, it } from "vitest";

import { parseNamedRows } from "./sqlite-json";

describe("parseNamedRows", () => {
	it("rejects rows without a string name", () => {
		expect(() => parseNamedRows('[{"name": 42}]')).toThrow("SQLite JSON named rows");
	});

	it("returns rows with string names and preserves additional SQLite fields", () => {
		expect(parseNamedRows('[{"name":"videos","type":"table"}]')).toEqual([
			{ name: "videos", type: "table" },
		]);
	});

	it("returns no rows for empty SQLite output", () => {
		expect(parseNamedRows("")).toEqual([]);
	});
});
