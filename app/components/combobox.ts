import { UiSchema } from "@effect/ui";
import { Combobox as KitCombobox, VirtualList, VirtualListScrollTarget } from "@effect/ui-kit";
import { Html } from "@effect/ui/html";
import { Schema } from "effect";

import { FilterOptions, matchFilterOptions } from "../search";
import { Icon } from "./icons";

const Selection = Schema.NullOr(Schema.String);
const Event = UiSchema.TaggedEnum({ Picked: { value: Selection } });
const Message = UiSchema.TaggedEnum({
	Opened: {},
	Closed: {},
	Typed: { query: Schema.String },
	Navigated: {},
	Picked: { value: Selection },
});

const closed = { open: false, query: "", scrollRevision: 0, resetScroll: true };
const rowHeight = 40;
const rowGap = 4;
const separatorHeight = 9;
const initialRows = 12;

export const Combobox = Html.component({
	name: "FilterPicker",
	props: Schema.Struct({
		value: Selection,
		options: FilterOptions,
		placeholder: Schema.String,
		searchLabel: Schema.String,
		ariaLabel: Schema.String,
		virtualize: Schema.Boolean,
	}),
	model: Schema.Struct({
		open: Schema.Boolean,
		query: Schema.String,
		scrollRevision: Schema.Number,
		resetScroll: Schema.Boolean,
	}),
	message: Message,
	events: Event,
	restore: false,
}).make({
	init: () => closed,
	update: {
		Opened: ($) => $.evolve({ ...closed, open: true }),
		Closed: () => closed,
		Typed: ($, { query }) =>
			$.evolve({ query, resetScroll: true, scrollRevision: $.model.scrollRevision + 1 }),
		Navigated: ($) => $.evolve({ resetScroll: false, scrollRevision: $.model.scrollRevision + 1 }),
		Picked: ($, { value }) => $.evolve(closed).emit(Event.Picked({ value })),
	},
	view: (h, { open, query, scrollRevision, resetScroll }) => {
		const { value, options, placeholder, searchLabel, ariaLabel, virtualize } = h.props;
		const anchorId = h.id("anchor");
		const selectedLabel =
			value === null ? placeholder : (options.find((item) => item.value === value)?.label ?? value);
		const emptyChoice = { label: placeholder, value: "" };
		const matchingOptions = matchFilterOptions(options, query);
		const items = [emptyChoice, ...options];
		const filteredItems = matchingOptions === options ? items : [emptyChoice, ...matchingOptions];
		const virtualized = virtualize && filteredItems.length > initialRows;

		return KitCombobox(h, {
			props: {
				align: "start",
				anchor: anchorId,
				autoHighlight: true,
				collisionAvoidance: { align: "shift", fallbackAxisSide: "none" },
				collisionPadding: 24,
				filteredItems,
				highlightItemOnHover: false,
				inputInPopup: true,
				inputValue: query,
				items,
				open,
				positionMethod: "fixed",
				sideOffset: 6,
				value: value ?? "",
				virtualized,
			},
			onEmit: {
				RequestedOpen: () => Message.Opened(),
				RequestedClose: () => Message.Closed(),
				RequestedInputValue: ({ inputValue }) => Message.Typed({ query: inputValue }),
				Picked: ({ value }) =>
					Message.Picked({ value: typeof value === "string" && value !== "" ? value : null }),
				Highlighted: ({ reason }) =>
					virtualize && reason === "keyboard" ? Message.Navigated() : undefined,
				Settled: () => undefined,
			},
			view: (picker) => {
				const trigger = picker
					.trigger(
						h.button
							.attr("aria-label", ariaLabel)
							.class(
								"decoration-accent/60 hover:decoration-accent focus-visible:decoration-accent relative inline-flex cursor-pointer items-center gap-1 px-0 py-0 text-accent-text underline decoration-dotted underline-offset-4 after:absolute after:-inset-y-2 after:inset-x-0 after:content-[''] hover:decoration-solid focus-visible:outline-none focus-visible:decoration-solid",
							),
					)
					.children(
						h.span.class("truncate text-base").children(selectedLabel),
						value === null && Icon(h, "ChevronDown", 12, "opacity-50"),
					);

				function renderOptions() {
					const choices = picker.items;
					const counts = new Map(matchingOptions.map(({ value, count }) => [value, count]));
					const separator = h.div.class("border-border mx-2 my-1 border-t").key("any-separator");

					function optionRow(item: (typeof choices)[number]) {
						const count = counts.get(item.value);
						return h.div
							.attr("title", count === undefined ? item.label : `${item.label} · ${count}`)
							.class(
								"hover:bg-panel-hover flex min-h-10 w-full cursor-pointer items-center justify-between rounded-sm px-3 py-2 text-left text-sm",
								virtualized
									? "group-data-highlighted:bg-panel-hover pointer-events-auto"
									: "data-highlighted:bg-panel-hover",
								item.value === (value ?? "")
									? "bg-accent-soft text-accent-text font-medium"
									: "text-text",
							)
							.children(
								h.span.class("max-w-60 truncate").children(item.label),
								count !== undefined &&
									h.span.class("text-muted shrink-0 text-xs tabular-nums").children(String(count)),
							);
					}

					if (!virtualized) {
						return picker.list(h.div.class("flex flex-col gap-1")).children(
							choices.flatMap((item) => [
								picker.item({ element: optionRow(item), value: item.value }),
								item.value === "" && matchingOptions.length > 0 && separator,
							]),
							matchingOptions.length === 0 &&
								h.p
									.attr("role", "status")
									.class("text-muted py-3 text-center text-sm")
									.children("No matches"),
						);
					}

					const highlighted = choices.findIndex((item) => item.value === picker.highlighted);
					const scrollTarget =
						highlighted === -1
							? resetScroll && VirtualListScrollTarget.Offset({ offset: 0 })
							: VirtualListScrollTarget.Index({ index: highlighted });
					return VirtualList(h, {
						props: {
							dataset: query,
							initialCount: initialRows,
							itemSize: rowHeight + rowGap,
							keys: choices.map((item) => item.value),
							layout: "absolute",
							scrollContainer: "nearest",
							scrollTo: scrollTarget
								? { align: "nearest", id: scrollRevision, target: scrollTarget }
								: undefined,
							// Include the divider and gaps in the estimates until the kit measures the rows.
							sizes: choices.map((_, index) => {
								if (index === 0) return rowHeight + rowGap * 2 + separatorHeight;
								return index === choices.length - 1 ? rowHeight : rowHeight + rowGap;
							}),
						},
						view: (list) => {
							// The input retains focus, so keep its active descendant mounted even offscreen.
							const indexes =
								highlighted !== -1 && !list.items.includes(highlighted)
									? [...list.items, highlighted].sort((a, b) => a - b)
									: list.items;
							return picker.list(list.list(h.div)).children(
								indexes.map((index) => {
									const item = choices[index]!;
									const first = index === 0;
									const element = h.div
										.class(
											"group pointer-events-none",
											first ? "pb-2" : index < choices.length - 1 && "pb-1",
										)
										.children(
											optionRow(item),
											first &&
												h.div.class("border-border mx-2 mt-2 border-t").attr("aria-hidden", "true"),
										);
									return list.item({ element: picker.item({ element, value: item.value }), index });
								}),
							);
						},
					});
				}

				const popup =
					picker.mounted &&
					picker.positioner(h.div.class("overflow-visible border-0 bg-transparent p-0")).children(
						picker
							.popup(
								h.div
									.class(
										"border-border bg-panel flex w-[calc(100vw-3rem)] flex-col gap-2 rounded-md border p-1 shadow-xl sm:w-70",
									)
									.attr("aria-label", ariaLabel),
							)
							.children(
								h.div.class("relative flex items-center gap-2 px-2 py-2").children(
									Icon(h, "MagnifyingGlass", 15, "text-muted shrink-0"),
									picker.input(
										h.input
											.attrs({
												"aria-label": `Search ${searchLabel}`,
												placeholder: `Search ${searchLabel}`,
											})
											.class(
												"placeholder:text-muted min-w-0 flex-1 bg-transparent py-1 text-base outline-none",
											),
									),
								),
								h.div.class("max-h-80 overflow-y-auto px-1 pb-1").children(renderOptions()),
							),
					);

				// The narrow layout anchors to the entire sentence. On larger screens
				// the relatively positioned wrapper makes the anchor match this trigger.
				const anchor = h.span
					.id(anchorId)
					.attr("aria-hidden", "true")
					.class("pointer-events-none absolute inset-0");
				return h.div.class("static inline-block sm:relative").children(anchor, trigger, popup);
			},
		});
	},
});
