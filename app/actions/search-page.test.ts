import { describe, expect, it } from "vitest";

import { getEventMetadata } from "./search-page";

describe("getEventMetadata", () => {
	it("represents event and year metadata explicitly", () => {
		expect(getEventMetadata("Tango Festival", 2024)).toEqual({
			event: { label: "Tango Festival", value: "Tango Festival" },
			kind: "event",
			label: "Tango Festival · 2024",
			year: "2024",
		});
	});

	it("keeps the complete event value while removing a repeated year from its label", () => {
		expect(getEventMetadata("Tango Festival 2024", 2024)).toMatchObject({
			event: { label: "Tango Festival", value: "Tango Festival 2024" },
			kind: "event",
		});
	});

	it("represents year-only metadata without a partial event object", () => {
		expect(getEventMetadata(null, 2024)).toEqual({
			kind: "year",
			label: "2024",
			year: "2024",
		});
		expect(getEventMetadata(null, null)).toBeNull();
	});
});
