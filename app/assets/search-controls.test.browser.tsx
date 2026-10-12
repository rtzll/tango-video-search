import * as assert from "remix/assert";
import { type RenderResult, render } from "remix/component/test";
import { describe, it, type TestContext } from "remix/test";

import type { SearchFilters, SearchOptions } from "../search.ts";
import { SearchControls } from "./search-controls.tsx";

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

const options: SearchOptions = {
	channel: [{ count: 9, label: "Channel One", value: "channel-1" }],
	dancer1: [
		{ count: 12, label: "Alice Example", value: "Alice Example" },
		{ count: 7, label: "Bob Example", value: "Bob Example" },
	],
	dancer2: [{ count: 5, label: "Carol Example", value: "Carol Example" }],
	event: [{ count: 3, label: "Tango Festival", value: "Tango Festival" }],
	orchestra: [{ count: 11, label: "Orchestra One", value: "Orchestra One" }],
	singer: [{ count: 6, label: "Singer One", value: "Singer One" }],
	song: [{ count: 8, label: "Song One", value: "Song One" }],
	year: [{ count: 4, label: "2024", value: "2024" }],
};

describe("search controls", () => {
	it("keeps a native GET fallback, then supports searchable keyboard selection", async (t) => {
		const navigation = stubNavigation(t);
		const result = render(
			<SearchControls filters={emptyFilters} options={options} searchParams="page=3&ref=shared" />,
		);
		t.after(result.cleanup);
		await settle(result);

		const trigger = result.$('button[aria-label="Select first dancer"]');
		assert.ok(trigger instanceof HTMLButtonElement);
		await result.act(() => trigger.click());

		let input = comboboxInput(result, "dancer1");
		const enhancedForm = input.closest("form");
		assert.ok(enhancedForm);
		assert.equal(enhancedForm.method, "get");

		input.focus();
		input.value = "Nobody";
		await result.act(() => {
			input.dispatchEvent(
				new InputEvent("input", {
					bubbles: true,
					data: "Nobody",
					inputType: "insertText",
				}),
			);
		});
		assert.equal(result.$('[role="status"]')?.textContent, "No matches");

		await result.act(() => {
			input.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "Escape" }));
		});
		assert.equal(trigger.getAttribute("aria-expanded"), "false");
		assert.equal(document.activeElement, trigger);

		await result.act(() => trigger.click());
		input = comboboxInput(result, "dancer1");
		input.value = "Ali";
		await result.act(() => {
			input.dispatchEvent(
				new InputEvent("input", {
					bubbles: true,
					data: "Ali",
					inputType: "insertText",
				}),
			);
		});

		assert.equal(input.getAttribute("aria-expanded"), "true");
		const listbox = document.getElementById(input.getAttribute("aria-controls") ?? "");
		assert.ok(listbox);
		assert.match(listbox.textContent ?? "", /Alice Example.*12/);
		assert.doesNotMatch(listbox.textContent ?? "", /Bob Example/);
		assert.equal(result.$$('[role="option"]:not([hidden])').length, 2);

		await result.act(() => {
			input.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "ArrowDown" }));
		});
		const activeOptionId = input.getAttribute("aria-activedescendant");
		assert.ok(activeOptionId);
		assert.doesNotMatch(activeOptionId, /\s/);
		assert.equal(document.getElementById(activeOptionId)?.getAttribute("role"), "option");

		await result.act(() => {
			input.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "Enter" }));
		});
		await settle(result);

		assert.equal(navigation.mock.calls.length, 1);
		assert.equal(navigation.mock.calls[0]?.arguments[0], "/?ref=shared&dancer1=Alice+Example");
	});

	it("keeps Reset when it cancels a pending native filter navigation", async (t) => {
		const initialUrl = globalThis.location.href;
		const destinations: string[] = [];
		const listeners = new AbortController();
		let pendingNavigation: NavigateEvent | undefined;
		let markStarted = () => {};
		const started = new Promise<void>((resolve) => {
			markStarted = resolve;
		});
		globalThis.navigation.addEventListener(
			"navigate",
			(event) => {
				const destination = new URL(event.destination.url);
				destinations.push(`${destination.pathname}${destination.search}`);
				event.intercept({
					focusReset: "manual",
					async handler() {
						if (destinations.length === 1) {
							pendingNavigation = event;
							await new Promise<void>((resolve) => {
								event.signal.addEventListener("abort", () => resolve(), { once: true });
								markStarted();
							});
						}
					},
					scroll: "manual",
				});
			},
			{ signal: listeners.signal },
		);
		t.after(async () => {
			await globalThis.navigation.navigate(initialUrl, { history: "replace" }).finished;
			listeners.abort();
		});
		const result = render(
			<SearchControls
				filters={{ ...emptyFilters, orchestra: "Orchestra One" }}
				options={options}
				searchParams="orchestra=Orchestra+One"
			/>,
		);
		t.after(result.cleanup);
		await settle(result);

		const trigger = result.$('button[aria-label="Select first dancer"]');
		assert.ok(trigger instanceof HTMLButtonElement);
		await result.act(() => trigger.click());
		const option = result.$('button[role="option"][title="Alice Example · 12"]');
		assert.ok(option instanceof HTMLButtonElement);
		await result.act(() => option.click());
		await started;

		const reset = result.$('a[aria-label="Reset filters"]');
		assert.ok(reset instanceof HTMLAnchorElement);
		await result.act(() => reset.click());
		await globalThis.navigation.transition?.finished.catch(() => undefined);
		await settle(result);

		assert.equal(pendingNavigation?.signal.aborted, true);
		assert.deepEqual(
			destinations,
			["/?orchestra=Orchestra+One&dancer1=Alice+Example", "/"],
			JSON.stringify(destinations),
		);
		assert.equal(globalThis.location.pathname + globalThis.location.search, "/");
	});

	it("preserves active filters when the advanced search input implicitly submits", async (t) => {
		const navigation = stubNavigation(t);
		const result = render(
			<SearchControls
				filters={{ ...emptyFilters, dancer1: "Alice Example" }}
				options={options}
				searchParams="dancer1=Alice+Example&page=2"
			/>,
		);
		t.after(result.cleanup);
		await settle(result);

		const trigger = result.$('button[aria-label="Choose performance details"]');
		assert.ok(trigger instanceof HTMLButtonElement);
		await result.act(() => trigger.click());
		await settle(result);

		const input = result.$('input[aria-label="Search song"]');
		assert.ok(input instanceof HTMLInputElement);
		input.value = "Song";
		await result.act(() => {
			input.dispatchEvent(new InputEvent("input", { bubbles: true }));
		});
		const form = input.closest("form");
		assert.ok(form);

		// Enter in this single text field causes the browser to submit its form.
		const submission = new SubmitEvent("submit", { bubbles: true, cancelable: true });
		await result.act(() => {
			form.dispatchEvent(submission);
		});

		assert.equal(submission.defaultPrevented, true);
		assert.equal(navigation.mock.calls.length, 0);
		assert.equal(input.value, "Song");
		assert.equal(trigger.getAttribute("aria-expanded"), "true");
		assert.match(
			result.$('button[aria-label="Select first dancer"]')?.textContent ?? "",
			/Alice Example/,
		);

		const songOption = result.$('button[role="option"][title="Song One (8)"]');
		assert.ok(songOption instanceof HTMLButtonElement);
		await result.act(() => songOption.click());
		assert.equal(navigation.mock.calls[0]?.arguments[0], "/?dancer1=Alice+Example&song=Song+One");
	});

	it("scrolls the selected option into view each time a long picker opens", async (t) => {
		const dancerOptions = Array.from({ length: 40 }, (_, index) => ({
			count: 1,
			label: `Dancer ${index}`,
			value: `Dancer ${index}`,
		}));
		const result = render(
			<SearchControls
				filters={{ ...emptyFilters, dancer1: "Dancer 35" }}
				options={{ ...options, dancer1: dancerOptions }}
				searchParams="dancer1=Dancer+35"
			/>,
		);
		t.after(result.cleanup);
		await settle(result);

		const trigger = result.$('button[aria-label="Select first dancer"]');
		assert.ok(trigger instanceof HTMLButtonElement);
		for (let opening = 0; opening < 2; opening++) {
			await result.act(() => trigger.click());
			await settle(result);
			const input = comboboxInput(result, "dancer1");
			const listbox = result.$('[role="listbox"]');
			const selected = result.$('[role="option"][aria-selected="true"]');
			assert.ok(listbox instanceof HTMLElement);
			assert.ok(selected instanceof HTMLButtonElement);
			assert.equal(selected.id, input.getAttribute("aria-activedescendant"));
			assert.ok(listbox.scrollTop > 0);
			const listBounds = listbox.getBoundingClientRect();
			const selectedBounds = selected.getBoundingClientRect();
			assert.ok(selectedBounds.top >= listBounds.top);
			assert.ok(selectedBounds.bottom <= listBounds.bottom);

			await result.act(() => {
				input.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "Escape" }));
			});
		}
	});

	it("expresses active filters as a removable sentence", async (t) => {
		const navigation = stubNavigation(t);
		const result = render(
			<SearchControls
				filters={{ ...emptyFilters, event: "Tango Festival" }}
				options={options}
				searchParams="event=Tango+Festival&page=2"
			/>,
		);
		t.after(result.cleanup);

		await settle(result);

		assert.match(result.container.textContent ?? "", /Only show performances/);
		assert.match(result.container.textContent ?? "", /where/);
		assert.match(result.container.textContent ?? "", /event is Tango Festival/);
		assert.match(result.container.textContent ?? "", /and…/);
		const reset = result.$('a[aria-label="Reset filters"]');
		assert.ok(reset instanceof HTMLAnchorElement);
		assert.equal(reset.getAttribute("href"), "/");

		const removeEvent = result.$('button[aria-label="Remove event condition"]');
		assert.ok(removeEvent instanceof HTMLButtonElement);
		await result.act(() => removeEvent.click());

		assert.equal(navigation.mock.calls.length, 1);
		assert.equal(navigation.mock.calls[0]?.arguments[0], "/");
	});

	it("keeps advanced-filter tabs and search visible while a long option list scrolls", async (t) => {
		const channelOptions = Array.from({ length: 40 }, (_, index) => ({
			count: 1,
			label: `Channel ${index}`,
			value: `channel-${index}`,
		}));
		const result = render(
			<SearchControls
				filters={emptyFilters}
				options={{ ...options, channel: channelOptions }}
				searchParams=""
			/>,
		);
		t.after(result.cleanup);
		await settle(result);

		const trigger = result.$('button[aria-label="Choose performance details"]');
		assert.ok(trigger instanceof HTMLButtonElement);
		await result.act(() => trigger.click());
		await settle(result);
		const channelTab = [...result.$$('button[role="tab"]')].find(
			(tab) => tab.textContent === "Channel",
		);
		assert.ok(channelTab instanceof HTMLButtonElement);
		await result.act(() => channelTab.click());
		await settle(result);

		const tabList = result.$('[role="tablist"]');
		const listbox = result.$('[role="listbox"]');
		const search = result.$('input[aria-label="Search channel"]');
		assert.ok(tabList instanceof HTMLElement);
		assert.ok(listbox instanceof HTMLElement);
		assert.ok(search instanceof HTMLInputElement);
		const tabListBounds = tabList.getBoundingClientRect();
		for (const tab of result.$$('button[role="tab"]')) {
			const bounds = tab.getBoundingClientRect();
			const label = document.createRange();
			label.selectNodeContents(tab);
			const labelBounds = label.getBoundingClientRect();
			assert.ok(bounds.top >= tabListBounds.top);
			assert.ok(bounds.bottom <= tabListBounds.bottom);
			assert.ok(labelBounds.top >= bounds.top, `${tab.textContent} label is clipped above`);
			assert.ok(labelBounds.bottom <= bounds.bottom, `${tab.textContent} label is clipped below`);
		}
		const searchBounds = search.getBoundingClientRect();
		const listBounds = listbox.getBoundingClientRect();
		assert.ok(searchBounds.top >= tabListBounds.bottom);
		assert.ok(searchBounds.bottom <= listBounds.top);
		assert.ok(listbox.scrollHeight > listbox.clientHeight);
		listbox.scrollTop = listbox.scrollHeight;
		assert.ok(listbox.scrollTop > 0);
		assert.equal(tabList.getBoundingClientRect().top, tabListBounds.top);
		assert.equal(search.getBoundingClientRect().top, searchBounds.top);
		const lastOption = listbox.lastElementChild;
		assert.ok(lastOption instanceof HTMLButtonElement);
		const lastBounds = lastOption.getBoundingClientRect();
		assert.ok(lastBounds.top >= listBounds.top);
		assert.ok(lastBounds.bottom <= listBounds.bottom);
	});

	it("uses the channel ID when selecting a human-readable channel option", async (t) => {
		const navigation = stubNavigation(t);
		const result = render(
			<SearchControls filters={emptyFilters} options={options} searchParams="page=2" />,
		);
		t.after(result.cleanup);
		await settle(result);

		const trigger = result.$('button[aria-label="Choose performance details"]');
		assert.ok(trigger instanceof HTMLButtonElement);
		await result.act(() => trigger.click());
		await settle(result);

		const channelTab = [...result.$$('button[role="tab"]')].find(
			(tab) => tab instanceof HTMLButtonElement && tab.textContent === "Channel",
		);
		assert.ok(channelTab instanceof HTMLButtonElement);
		await result.act(() => channelTab.click());
		await settle(result);

		const search = result.$('input[aria-label="Search channel"]');
		assert.ok(search instanceof HTMLInputElement);

		const channelOption = result.$('button[role="option"][title="Channel One (9)"]');
		assert.ok(channelOption instanceof HTMLButtonElement);
		await result.act(() => channelOption.click());
		await settle(result);

		assert.equal(navigation.mock.calls.length, 1);
		assert.equal(navigation.mock.calls[0]?.arguments[0], "/?channel=channel-1");
	});
});

function stubNavigation(t: TestContext) {
	return t.mock.method(
		globalThis.navigation,
		"navigate",
		() =>
			({
				committed: Promise.resolve(),
				finished: Promise.resolve(),
			}) as unknown as NavigationResult,
	);
}

function comboboxInput(result: RenderResult, id: string) {
	const input = result.$(`#${id}`);
	assert.ok(input instanceof HTMLInputElement, result.container.innerHTML);
	return input;
}

async function settle(result: RenderResult) {
	await result.act(() => undefined);
	await result.act(() => undefined);
}
