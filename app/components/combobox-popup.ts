import { UiSchema } from "@effect/ui";
import { Combobox as KitCombobox } from "@effect/ui-kit";
import { Html } from "@effect/ui/html";
import { Schema } from "effect";

import { FilterOptions } from "../search";
import { Icon } from "./icons";
import { filterPickerOptions, getPickerIndex, getPickerItemsWithEmpty } from "./picker-options";
import { virtualizationThreshold, VirtualPickerOptions } from "./virtual-picker-options";

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

export const ComboboxPopup = Html.component({
	name: "FilterPickerPopup",
	props: Schema.Struct({
		value: Selection,
		options: FilterOptions,
		placeholder: Schema.String,
		searchLabel: Schema.String,
		ariaLabel: Schema.String,
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
	init: () => ({ ...closed, open: true }),
	update: {
		Opened: ($) => $.evolve({ ...closed, open: true }),
		Closed: () => closed,
		Typed: ($, { query }) =>
			$.evolve({ query, resetScroll: true, scrollRevision: $.model.scrollRevision + 1 }),
		Navigated: ($) => $.evolve({ resetScroll: false, scrollRevision: $.model.scrollRevision + 1 }),
		Picked: ($, { value }) => $.evolve(closed).emit(Event.Picked({ value })),
	},
	view: (h, { open, query, scrollRevision, resetScroll }) => {
		const { value, options, placeholder, searchLabel, ariaLabel } = h.props;
		const anchorId = h.id("anchor");
		const index = getPickerIndex(options);
		const selectedLabel = value === null ? placeholder : (index.labels.get(value) ?? value);
		const items = getPickerItemsWithEmpty(options, placeholder);
		const { items: filteredItems, matchCount } = filterPickerOptions(options, query, placeholder);
		const virtualized = filteredItems.length > virtualizationThreshold;

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
				Picked: ({ value: pickedValue }) =>
					Message.Picked({
						value: typeof pickedValue === "string" && pickedValue !== "" ? pickedValue : null,
					}),
				Highlighted: ({ reason }) =>
					virtualized && reason === "keyboard" ? Message.Navigated() : undefined,
				Settled: () => undefined,
			},
			view: (picker) => {
				const trigger = picker
					.trigger(
						h.button
							.attr("aria-label", ariaLabel)
							.class(
								"decoration-accent/60 hover:decoration-accent focus-visible:decoration-accent relative inline-flex max-w-full cursor-pointer items-baseline gap-1 text-left text-accent-text underline decoration-dotted underline-offset-4 after:absolute after:-inset-y-2 after:inset-x-0 after:content-[''] hover:decoration-solid focus-visible:outline-none focus-visible:decoration-solid",
							),
					)
					.children(
						h.span.class("min-w-0 wrap-anywhere text-base").children(selectedLabel),
						value === null && Icon(h, "ChevronDown", 12, "shrink-0 self-center opacity-50"),
					);

				function renderOptions() {
					const choices = picker.items;
					const { counts } = index;
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
						return h.div.class("max-h-80 min-h-0 overflow-y-auto px-1 pb-1").children(
							picker.list(h.div.class("flex flex-col gap-1")).children(
								choices.flatMap((item) => [
									picker.item({ element: optionRow(item), value: item.value }),
									item.value === "" && matchCount > 0 && separator,
								]),
								matchCount === 0 &&
									h.p
										.attr("role", "status")
										.class("text-muted py-3 text-center text-sm")
										.children("No matches"),
							),
						);
					}

					return VirtualPickerOptions(h, {
						items: choices,
						highlighted: picker.highlighted,
						scrollRevision,
						resetScroll,
						divider: true,
						viewport: h.div.class("max-h-80 min-h-0 overflow-y-auto px-1 pb-1"),
						wrapList: (rows) => picker.list(h.div).children(rows),
						row: optionRow,
						option: (element, optionValue) => picker.item({ element, value: optionValue }),
					});
				}

				const popup =
					picker.mounted &&
					picker.positioner(h.div.class("overflow-visible border-0 bg-transparent p-0")).children(
						picker
							.popup(
								h.div
									.class(
										"border-border bg-panel flex max-h-[var(--available-height,100dvh)] w-[calc(100vw-3rem)] flex-col gap-2 rounded-md border p-1 shadow-xl sm:w-70",
									)
									.attr("aria-label", ariaLabel),
							)
							.children(
								h.div.class("relative flex shrink-0 items-center gap-2 px-2 py-2").children(
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
								renderOptions(),
							),
					);

				// The narrow layout anchors to the entire sentence. On larger screens
				// the relatively positioned wrapper makes the anchor match this trigger.
				const anchor = h.span
					.id(anchorId)
					.attr("aria-hidden", "true")
					.class("pointer-events-none absolute inset-0");
				return h.div.class("static min-w-0 sm:relative").children(anchor, trigger, popup);
			},
		});
	},
});
