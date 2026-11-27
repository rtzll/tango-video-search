import { Html } from "@effect/ui/html";
import { HtmlLocator, HtmlPlay } from "@effect/ui/html/testing";
import { Locator, TestHost, type TestHost as TestHostTypes } from "@effect/ui/testing";
import { Effect, Layer } from "effect";
import { describe, expect, it } from "vite-plus/test";

import { AdvancedFilters } from "./advanced-filters";
import { Combobox } from "./combobox";

const emptyFilters = {
	channel: null,
	dancer1: null,
	dancer2: null,
	event: null,
	orchestra: null,
	singer: null,
	song: null,
	year: null,
};

const sampleOptions = {
	channel: [{ count: 5, label: "Tango Channel", value: "ch-1" }],
	dancer1: [
		{ count: 10, label: "Agustina Piaggio", value: "Agustina Piaggio" },
		{ count: 8, label: "Carlitos Espinoza", value: "Carlitos Espinoza" },
	],
	dancer2: [],
	event: [{ count: 3, label: "Embrace Berlin", value: "Embrace Berlin" }],
	orchestra: [
		{ count: 25, label: "Juan D'Arienzo", value: "Juan D'Arienzo" },
		{ count: 12, label: "Osvaldo Pugliese", value: "Osvaldo Pugliese" },
	],
	singer: [{ count: 7, label: "Alberto Echagüe", value: "Alberto Echagüe" }],
	song: [
		{ count: 9, label: "Paciencia", value: "Paciencia" },
		{ count: 4, label: "La Yumba", value: "La Yumba" },
	],
	year: [
		{ count: 11, label: "2024", value: "2024" },
		{ count: 6, label: "2023", value: "2023" },
	],
};

function makeSpyHtmlHost(focused: string[]) {
	return Layer.succeed(Html.Host, {
		blur: () => undefined,
		focus: (node) => {
			const element = node as unknown as TestHostTypes.TestElement;
			focused.push(element.attrs["aria-label"] ?? element.tag);
		},
		measure: () => ({ bottom: 0, height: 0, left: 0, right: 0, top: 0, width: 0, x: 0, y: 0 }),
		requestSubmit: () => false,
		scrollIntoView: () => undefined,
		select: () => undefined,
		showPicker: () => false,
	});
}

describe("Filter picker components", () => {
	it("lazy-loads ComboboxPopup, filters accent-insensitively, and emits Picked", async () => {
		const focused: string[] = [];
		const layers = Layer.mergeAll(TestHost.layer(), makeSpyHtmlHost(focused));

		await Effect.runPromise(
			Effect.gen(function* () {
				const play = yield* HtmlPlay.make(Combobox, {
					ariaLabel: "Select orchestra",
					options: sampleOptions.orchestra,
					placeholder: "any orchestra",
					searchLabel: "orchestra",
					value: null,
				});

				const trigger = HtmlLocator.role("combobox", { name: "Select orchestra" });
				yield* play.expect(trigger).toHaveAttribute("aria-expanded", "false");

				Locator.fire(play.root.get(trigger), "mouseenter", {});
				yield* TestHost.settle;

				yield* play.click(trigger);
				const searchInput = HtmlLocator.role("combobox", { name: "Search orchestra" });
				yield* play.expect(searchInput).toExist();

				yield* play.type(searchInput, "darienzo");
				yield* play.expect(Locator.text("Juan D'Arienzo")).toExist();
				yield* play.expect(Locator.text("Osvaldo Pugliese")).toBeAbsent();

				yield* play.click(HtmlLocator.role("option", { name: /Juan D'Arienzo/ }));
				expect(play.root.emitted).toEqual([{ _tag: "Picked", value: "Juan D'Arienzo" }]);
			}).pipe(Effect.scoped, Effect.provide(layers)),
		);
	});

	it("lazy-loads AdvancedFiltersPopover, switches tabs, and emits Changed", async () => {
		const focused: string[] = [];
		const layers = Layer.mergeAll(TestHost.layer(), makeSpyHtmlHost(focused));

		await Effect.runPromise(
			Effect.gen(function* () {
				const play = yield* HtmlPlay.make(AdvancedFilters, {
					filters: emptyFilters,
					options: sampleOptions,
				});

				yield* play.click(HtmlLocator.role("button", { name: "Choose performance details" }));
				yield* play.expect(HtmlLocator.role("tab", { name: "Year" })).toExist();

				yield* play.click(HtmlLocator.role("tab", { name: "Year" }));
				yield* play.click(HtmlLocator.role("option", { name: /2024/ }));

				expect(play.root.emitted).toEqual([{ _tag: "Changed", key: "year", value: "2024" }]);
			}).pipe(Effect.scoped, Effect.provide(layers)),
		);
	});

	it("restores focus to neighbor chip and then to the add trigger on keyboard removal", async () => {
		const focused: string[] = [];
		const layers = Layer.mergeAll(TestHost.layer(), makeSpyHtmlHost(focused));

		await Effect.runPromise(
			Effect.gen(function* () {
				const play = yield* HtmlPlay.make(AdvancedFilters, {
					filters: { ...emptyFilters, song: "Paciencia", year: "2024" },
					options: sampleOptions,
				});

				// Keyboard click has pointerType "" and should focus the neighbor condition's remove button.
				const removeSong = play.root.get(
					HtmlLocator.role("button", { name: "Remove song condition" }),
				);
				Locator.fire(removeSong, "click", { pointerType: "" });
				yield* TestHost.settle;

				expect(play.root.emitted).toEqual([{ _tag: "Changed", key: "song", value: null }]);
				expect(focused).toEqual(["Remove year condition"]);

				// Update props to reflect song removed, then remove the last condition via keyboard.
				play.root.setProps({
					filters: { ...emptyFilters, year: "2024" },
					options: sampleOptions,
				});
				yield* TestHost.settle;
				const removeYear = play.root.get(
					HtmlLocator.role("button", { name: "Remove year condition" }),
				);
				Locator.fire(removeYear, "click", { pointerType: "" });
				yield* TestHost.settle;

				expect(focused).toEqual(["Remove year condition", "Add another performance detail"]);
			}).pipe(Effect.scoped, Effect.provide(layers)),
		);
	});
});
