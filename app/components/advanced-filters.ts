import { Command, Component, UiSchema } from "@effect/ui";
import { Html, HtmlCommand } from "@effect/ui/html";
import { Effect, Schema } from "effect";

import { SearchFilters, SearchOptions } from "../search";
import { Icon } from "./icons";
import { getPickerIndex } from "./picker-options";

const LazyAdvancedFiltersPopover = Component.lazy("AdvancedFiltersPopover", () =>
	import("./advanced-filters-popover").then((module) => module.AdvancedFiltersPopover),
);

const PreloadAdvancedFiltersPopover = Command.make("PreloadAdvancedFiltersPopover", {}, () =>
	Effect.sync(() => {
		void LazyAdvancedFiltersPopover.preload();
	}).pipe(Effect.as(Component.noop)),
);

const advancedFilters = [
	{ key: "song", label: "Song" },
	{ key: "singer", label: "Singer" },
	{ key: "event", label: "Event" },
	{ key: "year", label: "Year" },
	{ key: "channel", label: "Channel" },
] as const;

const AdvancedKey = Schema.Literals(advancedFilters.map(({ key }) => key));
const Filter = Schema.NullOr(Schema.String);
const ConditionGroup = Html.ref("ConditionGroup", "div");
const AddCondition = Html.ref("AddCondition", "button");
const RemoveCondition = Html.ref("RemoveCondition", "button");

const addConditionClass =
	"border-border hover:bg-accent-soft text-accent-text inline-flex h-6 cursor-pointer items-center gap-1 rounded-sm border border-dashed px-2 text-xs relative pointer-coarse:after:absolute pointer-coarse:after:-inset-1.5 pointer-coarse:after:content-['']";

const Event = UiSchema.TaggedEnum({ Changed: { key: AdvancedKey, value: Filter } });
const Message = UiSchema.TaggedEnum({
	Opened: {},
	Closed: { restoreFocus: Schema.Boolean },
	PreloadRequested: {},
	SelectedTab: { key: AdvancedKey },
	Changed: { key: AdvancedKey, value: Filter },
	Removed: { key: AdvancedKey, restoreFocus: Schema.Boolean },
	FocusConditionGroup: {},
});

export const AdvancedFilters = Html.component({
	name: "AdvancedFilters",
	props: Schema.Struct({ filters: SearchFilters, options: SearchOptions }),
	model: Schema.Struct({
		selectedKey: AdvancedKey,
		open: Schema.Boolean,
	}),
	message: Message,
	events: Event,
	restore: false,
}).make({
	init: () => ({ open: false, selectedKey: "song" }),
	update: {
		Opened: ($) => $.evolve({ open: true }),
		PreloadRequested: ($) => ($.model.open ? $.model : $.run(PreloadAdvancedFiltersPopover.make())),
		Closed: ($, { restoreFocus }) => {
			const closed = $.evolve({ open: false });
			return restoreFocus
				? closed.run(HtmlCommand.focus(AddCondition, () => Component.noop, { preventScroll: true }))
				: closed;
		},
		SelectedTab: ($, { key }) => $.evolve({ selectedKey: key }),
		Changed: ($, { key, value }) => $.evolve({ open: false }).emit(Event.Changed({ key, value })),
		Removed: ($, { key, restoreFocus }) => {
			const removed = $.evolve({ open: false }).emit(Event.Changed({ key, value: null }));
			if (!restoreFocus) {
				return removed;
			}
			const active = advancedFilters.filter((filter) => $.props.filters[filter.key] !== null);
			const index = active.findIndex((filter) => filter.key === key);
			const neighbor = active[index + 1] ?? active[index - 1];
			return removed.run(
				HtmlCommand.focus(
					neighbor ? RemoveCondition.at(neighbor.key) : AddCondition,
					({ found }) => (found ? Component.noop : Message.FocusConditionGroup()),
					{ preventScroll: true },
				),
			);
		},
		FocusConditionGroup: ($) =>
			$.run(HtmlCommand.focus(ConditionGroup, () => Component.noop, { preventScroll: true })),
	},
	view: (h, { selectedKey, open }) => {
		const { filters, options } = h.props;
		const activeFilters = advancedFilters.filter(({ key }) => filters[key] !== null);
		const available = advancedFilters.filter(
			({ key }) => filters[key] === null && options[key].length > 0,
		);
		const group = h.div.ref(ConditionGroup).attr("tabindex", "-1");
		if (activeFilters.length === 0 && available.length === 0) {
			return group;
		}

		const hasFilters = activeFilters.length > 0;
		const staticTrigger = () =>
			h.div.class("inline-flex").children(
				h.button
					.ref(AddCondition)
					.attrs({
						type: "button",
						"aria-expanded": "false",
						"aria-haspopup": "dialog",
						"aria-label": hasFilters
							? "Add another performance detail"
							: "Choose performance details",
					})
					.class(addConditionClass)
					.on("mouseenter", Message.PreloadRequested())
					.on("focus", Message.PreloadRequested())
					.on("click", Message.Opened())
					.children(hasFilters ? "and…" : "where…"),
			);

		const picker =
			available.length > 0 &&
			(open
				? LazyAdvancedFiltersPopover(h, {
						props: { filters, options, selectedKey, hasFilters },
						onEmit: {
							Changed: ({ key, value }) => Message.Changed({ key, value }),
							Closed: ({ restoreFocus }) => Message.Closed({ restoreFocus }),
							SelectedTab: ({ key }) => Message.SelectedTab({ key }),
						},
						fallback: () => staticTrigger(),
					})
				: staticTrigger());

		return group
			.class("text-muted relative flex flex-wrap items-center gap-2 text-sm leading-7 mt-3 sm:mt-2")
			.children(
				h.span("Only show performances"),
				hasFilters && h.span("where"),
				activeFilters.flatMap(({ key, label }, index) => {
					const value = filters[key];
					if (value === null) {
						return [];
					}
					const selectedLabel = getPickerIndex(options[key]).labels.get(value) ?? value;
					return [
						index > 0 && h.span.key(`${key}-and`).children("and"),
						h.button
							.key(key)
							.ref(RemoveCondition.at(key))
							.attrs({
								type: "button",
								"aria-label": `Remove ${label.toLowerCase()} condition`,
							})
							.on("click", ({ pointerType }) =>
								Message.Removed({ key, restoreFocus: pointerType === "" }),
							)
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
