import { UiSchema } from "@effect/ui";
import { Combobox, Popover } from "@effect/ui-kit";
import { makeTabs } from "@effect/ui-kit/Tabs";
import { Html } from "@effect/ui/html";
import { Schema } from "effect";

import { SearchFilters, SearchOptions, matchFilterOptions } from "../search";
import { Icon } from "./icons";

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

const Event = UiSchema.TaggedEnum({ Changed: { key: AdvancedKey, value: Filter } });
const Message = UiSchema.TaggedEnum({
	Opened: {},
	Closed: {},
	SelectedTab: { key: AdvancedKey },
	Typed: { query: Schema.String },
	Changed: { key: AdvancedKey, value: Filter },
});

const closed = { open: false, query: "" };

export const AdvancedFilters = Html.component({
	name: "AdvancedFilters",
	props: Schema.Struct({ filters: SearchFilters, options: SearchOptions }),
	model: Schema.Struct({
		selectedKey: AdvancedKey,
		query: Schema.String,
		open: Schema.Boolean,
	}),
	message: Message,
	events: Event,
	restore: false,
}).make({
	init: () => ({ ...closed, selectedKey: "song" }),
	update: {
		Opened: ($) => $.evolve({ open: true }),
		Closed: ($) => $.evolve(closed),
		SelectedTab: ($, { key }) => $.evolve({ selectedKey: key, query: "" }),
		Typed: ($, { query }) => $.evolve({ query }),
		Changed: ($, { key, value }) => $.evolve(closed).emit(Event.Changed({ key, value })),
	},
	view: (h, { selectedKey, query, open }) => {
		const { filters, options } = h.props;
		const activeFilters = advancedFilters.filter(({ key }) => filters[key] !== null);
		const available = advancedFilters.filter(
			({ key }) => filters[key] === null && options[key].length > 0,
		);
		if (activeFilters.length === 0 && available.length === 0) {
			return h.text("");
		}

		const activeTab = available.find(({ key }) => key === selectedKey) ?? available[0];
		const hasFilters = activeFilters.length > 0;
		const picker =
			activeTab &&
			Popover(h, {
				props: {
					align: "start",
					collisionAvoidance: { align: "shift", fallbackAxisSide: "none" },
					collisionPadding: 16,
					open,
					positionMethod: "fixed",
					sideOffset: 6,
				},
				onEmit: {
					RequestedOpen: () => Message.Opened(),
					RequestedClose: () => Message.Closed(),
					Settled: () => undefined,
				},
				view: (popover) => {
					const trigger = popover
						.trigger({
							element: h.button
								.attr(
									"aria-label",
									hasFilters ? "Add another performance detail" : "Choose performance details",
								)
								.class(
									"border-border hover:bg-accent-soft text-accent-text inline-flex h-6 cursor-pointer items-center gap-1 rounded-sm border border-dashed px-2 text-xs relative pointer-coarse:after:absolute pointer-coarse:after:-inset-1.5 pointer-coarse:after:content-['']",
								),
						})
						.children(hasFilters ? "and…" : "where…");

					function renderChoices(tab: (typeof advancedFilters)[number]) {
						const matching = matchFilterOptions(options[tab.key], query).slice(0, 100);
						const counts = new Map(matching.map(({ value, count }) => [value, count]));
						const label = `Search ${tab.label.toLowerCase()}`;

						return Combobox(h, {
							props: {
								autoHighlight: true,
								filter: "none",
								highlightItemOnHover: false,
								inline: true,
								inputValue: query,
								items: matching,
								open: false,
							},
							onEmit: {
								Picked: ({ value }) =>
									typeof value === "string" ? Message.Changed({ key: tab.key, value }) : undefined,
								RequestedInputValue: ({ inputValue }) => Message.Typed({ query: inputValue }),
								RequestedOpen: () => undefined,
								RequestedClose: () => undefined,
								Highlighted: () => undefined,
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
								const list = picker
									.list(h.div.class("flex min-h-0 flex-col gap-1 overflow-y-auto px-1 pb-1"))
									.children(
										picker.items.map(({ label, value }) =>
											picker
												.item({
													element: h.div.class(
														"hover:bg-panel-hover data-highlighted:bg-panel-hover text-text flex min-h-10 w-full cursor-pointer items-center justify-between gap-3 rounded-sm px-3 py-2 text-left text-sm",
													),
													value,
												})
												.children(
													h.span.class("max-w-60 truncate").children(label),
													h.span
														.class("text-muted shrink-0 text-xs tabular-nums")
														.children(String(counts.get(value))),
												),
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
								tabs: available.map(({ key }) => ({ value: key })),
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

		return h.div
			.class("text-muted relative flex flex-wrap items-center gap-2 text-sm leading-7 mt-3 sm:mt-2")
			.children(
				h.span("Only show performances"),
				hasFilters && h.span("where"),
				activeFilters.flatMap(({ key, label }, index) => {
					const value = filters[key];
					if (value === null) {
						return [];
					}
					const selectedLabel =
						options[key].find((option) => option.value === value)?.label ?? value;
					return [
						index > 0 && h.span.key(`${key}-and`).children("and"),
						h.button
							.key(key)
							.attrs({
								type: "button",
								"aria-label": `Remove ${label.toLowerCase()} condition`,
							})
							.on("click", Message.Changed({ key, value: null }))
							.class(
								"bg-accent-soft hover:bg-accent-soft-hover text-accent-text inline-flex h-6 max-w-full cursor-pointer items-center gap-1 rounded-sm px-2 text-xs relative pointer-coarse:after:absolute pointer-coarse:after:-inset-1.5 pointer-coarse:after:content-['']",
							)
							.children(
								h.span
									.class("max-w-64 truncate")
									.children(`${label.toLowerCase()} is ${selectedLabel}`),
								Icon(h, "Cross1", 10, "shrink-0"),
							),
					];
				}),
				picker,
			);
	},
});
