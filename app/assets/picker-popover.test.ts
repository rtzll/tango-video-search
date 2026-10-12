import { describe, expect, it } from "vitest";

import { getViewportPopoverPosition } from "./picker-popover.ts";

describe("viewport popover placement", () => {
	it("opens above and clamps to the right viewport edge", () => {
		expect(
			getViewportPopoverPosition(
				{ bottom: 270, height: 20, left: 380, top: 250, width: 20 },
				{ bottom: 0, height: 200, left: 0, top: 0, width: 320 },
				{ height: 300, width: 400 },
			),
		).toEqual({ left: 64, top: 44 });
	});

	it("opens below and keeps a margin from the left viewport edge", () => {
		expect(
			getViewportPopoverPosition(
				{ bottom: 40, height: 20, left: -20, top: 20, width: 20 },
				{ bottom: 0, height: 100, left: 0, top: 0, width: 100 },
				{ height: 300, width: 400 },
			),
		).toEqual({ left: 16, top: 46 });
	});
});
