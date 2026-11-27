import { UiSchema } from "@effect/ui";
import { Combobox, type ComboboxItem, Popover } from "@effect/ui-kit";
import { makeTabs } from "@effect/ui-kit/Tabs";
import { Html } from "@effect/ui/html";
import { Schema } from "effect";

import { SearchFilters, SearchOptions } from "../search";
import { Icon } from "./icons";
import { filterPickerOptions, getPickerIndex } from "./picker-options";
import { virtualizationThreshold, VirtualPickerOptions } from "./virtual-picker-options";

const advancedFilters = [
	{ key: "song", label: "Song" },
	{ key: "singer", label: "Singer" },
	{ key: "event", label: "Event" },
	{ key: "year", label: "Year" },
	{ key: "channel", label: "Channel" },
] as const;

const AdvancedKey = Schema.Literals(advancedFilters.map(({ key }) => key));
const Filter = Schema.NullOr(Schema.String);
const FilterTabs = makeTabs({ value: AdvancedKey });

const Event = UiSchema.TaggedEnum({
	Changed: { key: AdvancedKey, value: Filter },
	Closed: { restoreFocus: Schema.Boolean },
	SelectedTab: { key: AdvancedKey },
});
const Message = UiSchema.TaggedEnum({
	Closed: { restoreFocus: Schema.Boolean },
	SelectedTab: { key: AdvancedKey },
	Typed: { query: Schema.String },
	Navigated: {},
	Changed: { key: AdvancedKey, value: Filter },
});

const tabsCache = new Map<
	string,
	readonly { readonly value: (typeof advancedFilters)[number]["key"] }[]
>();

function getFilterTabs(available: readonly (typeof advancedFilters)[number][]) {
	const cacheKey = available.map((tab) => tab.key).join(",");
	let cached = tabsCache.get(cacheKey);
	if (cached === undefined) {
		cached = available.map(({ key: value }) => ({ value }));
		tabsCache.set(cacheKey, cached);
	}
	return cached;
}

const addConditionClass =
	"border-border hover:bg-accent-soft text-accent-text inline-flex h-6 cursor-pointer items-center gap-1 rounded-sm border border-dashed px-2 text-xs relative pointer-coarse:after:absolute pointer-coarse:after:-inset-1.5 pointer-coarse:after:content-['']";

export const AdvancedFiltersPopover = Html.component({
	name: "AdvancedFiltersPopover",
	props: Schema.Struct({
		filters: SearchFilters,
		options: SearchOptions,
		selectedKey: AdvancedKey,
		hasFilters: Schema.Boolean,
	}),
	model: Schema.Struct({
		query: Schema.String,
		scrollRevision: Schema.Number,
		resetScroll: Schema.Boolean,
	}),
	message: Message,
	events: Event,
	restore: false,
}).make({
	init: () => ({ query: "", scrollRevision: 0, resetScroll: true }),
	update: {
		Closed: ($, { restoreFocus }) => $.emit(Event.Closed({ restoreFocus })),
		SelectedTab: ($, { key }) =>
			$.evolve({
				query: "",
				resetScroll: true,
				scrollRevision: $.model.scrollRevision + 1,
			}).emit(Event.SelectedTab({ key })),
		Typed: ($, { query }) =>
			$.evolve({ query, resetScroll: true, scrollRevision: $.model.scrollRevision + 1 }),
		Navigated: ($) => $.evolve({ resetScroll: false, scrollRevision: $.model.scrollRevision + 1 }),
		Changed: ($, { key, value }) => $.emit(Event.Changed({ key, value })),
	},
	view: (h, { query, scrollRevision, resetScroll }) => {
		const { filters, options, selectedKey, hasFilters } = h.props;
		const available = advancedFilters.filter(
			({ key }) => filters[key] === null && options[key].length > 0,
		);
		const activeTab = available.find(({ key }) => key === selectedKey) ?? available[0];
		if (!activeTab) {
			return h.div.class("inline-flex");
		}
		const addConditionId = h.id("add-condition");

		return Popover(h, {
			props: {
				align: "start",
				anchor: addConditionId,
				collisionAvoidance: { align: "shift", fallbackAxisSide: "none" },
				collisionPadding: 16,
				open: true,
				positionMethod: "fixed",
				sideOffset: 6,
			},
			onEmit: {
				RequestedOpen: () => undefined,
				RequestedClose: ({ reason }) =>
					Message.Closed({
						restoreFocus:
							reason === "escape-key" || reason === "close-press" || reason === "trigger-press",
					}),
				Settled: () => undefined,
			},
			view: (popover) => {
				const trigger = popover
					.trigger({
						element: h.button
							.id(addConditionId)
							.attr(
								"aria-label",
								hasFilters ? "Add another performance detail" : "Choose performance details",
							)
							.class(addConditionClass),
					})
					.children(hasFilters ? "and…" : "where…");

				function renderChoices(tab: (typeof advancedFilters)[number]) {
					const tabOptions = options[tab.key];
					const { counts } = getPickerIndex(tabOptions);
					const { items: matching } = filterPickerOptions(tabOptions, query);
					const label = `Search ${tab.label.toLowerCase()}`;
					const virtualized = matching.length > virtualizationThreshold;

					return Combobox(h, {
						key: tab.key,
						props: {
							autoHighlight: true,
							filter: "none",
							highlightItemOnHover: false,
							inline: true,
							inputValue: query,
							items: matching,
							open: false,
							virtualized,
						},
						onEmit: {
							Picked: ({ value }) =>
								typeof value === "string" ? Message.Changed({ key: tab.key, value }) : undefined,
							RequestedInputValue: ({ inputValue, reason }) =>
								reason === "item-press" ? undefined : Message.Typed({ query: inputValue }),
							RequestedOpen: () => undefined,
							RequestedClose: () => undefined,
							Highlighted: ({ reason }) =>
								virtualized && reason === "keyboard" ? Message.Navigated() : undefined,
							Settled: () => undefined,
						},
						view: (picker) => {
							const input = picker.input(
								h.input
									.attrs({
										"aria-label": label,
										placeholder: label,
									})
									.class(
										"placeholder:text-muted min-w-0 flex-1 bg-transparent py-1 text-base outline-none",
									),
							);
							const optionRow = ({ label: itemLabel, value }: ComboboxItem) =>
								h.div
									.class(
										"hover:bg-panel-hover text-text flex min-h-10 w-full cursor-pointer items-center justify-between gap-3 rounded-sm px-3 py-2 text-left text-sm",
										virtualized
											? "group-data-highlighted:bg-panel-hover pointer-events-auto"
											: "data-highlighted:bg-panel-hover",
									)
									.children(
										h.span.class("max-w-60 truncate").children(itemLabel),
										h.span
											.class("text-muted shrink-0 text-xs tabular-nums")
											.children(String(counts.get(value))),
									);
							const list = virtualized
								? VirtualPickerOptions(h, {
										items: picker.items,
										highlighted: picker.highlighted,
										scrollRevision,
										resetScroll,
										viewport: picker.list(
											h.div.class("flex min-h-0 flex-col gap-1 overflow-y-auto px-1 pb-1"),
										),
										row: optionRow,
										option: (element, value) => picker.item({ element, value }),
									})
								: picker
										.list(h.div.class("flex min-h-0 flex-col gap-1 overflow-y-auto px-1 pb-1"))
										.children(
											picker.items.map((item) =>
												picker.item({ element: optionRow(item), value: item.value }),
											),
											picker
												.empty(h.div)
												.children(
													h.p.class("text-muted py-3 text-center text-sm").children("No matches"),
												),
										);

							return h.div
								.class("flex min-h-0 flex-col")
								.children(
									h.div
										.class("relative flex shrink-0 items-center gap-2 px-2 py-2")
										.children(
											Icon(h, "MagnifyingGlass", 15, "text-muted shrink-0"),
											popover.initialFocus(input),
										),
									list,
								);
						},
					});
				}

				const tabsView = () =>
					FilterTabs(h, {
						props: {
							value: activeTab.key,
							tabs: getFilterTabs(available),
						},
						onEmit: { Selected: ({ value }) => Message.SelectedTab({ key: value }) },
						view: (tabs) =>
							tabs.root(h.div.class("flex min-h-0 flex-col")).children(
								tabs
									.list(
										h.div
											.attr("aria-label", "Performance detail")
											.class("flex shrink-0 gap-1 overflow-x-auto px-1 pt-1"),
									)
									.children(
										available.map(({ key, label }) =>
											tabs
												.tab({
													element: h.button.class(
														"shrink-0 cursor-pointer rounded-sm px-2 py-1.5 text-xs",
														key === activeTab.key
															? "bg-accent-soft text-accent-text font-medium"
															: "text-muted hover:bg-panel-hover hover:text-text",
													),
													value: key,
												})
												.children(label),
										),
									),
								tabs
									.panel({ element: h.div.class("flex min-h-0 flex-col"), value: activeTab.key })
									?.children(renderChoices(activeTab)),
							),
					});

				const popup = popover
					.portal(h.dialog.attr("aria-label", "Add a filter condition"))
					?.children(
						popover
							.positioner(h.div)
							.children(
								popover
									.popup(
										h.div.class(
											"border-border bg-panel flex max-h-[min(20rem,calc(100dvh-2rem),var(--available-height,100dvh))] w-[min(20rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-md border p-1 shadow-xl",
										),
									)
									.children(tabsView()),
							),
					);
				return h.div.class("inline-flex").children(trigger, popup);
			},
		});
	},
});
