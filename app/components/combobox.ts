import { Command, Component, UiSchema } from "@effect/ui";
import { Html } from "@effect/ui/html";
import { Effect, Schema } from "effect";

import { FilterOptions } from "../search";
import { Icon } from "./icons";
import { getPickerIndex } from "./picker-options";

const LazyComboboxPopup = Component.lazy("FilterPickerPopup", () =>
	import("./combobox-popup").then((module) => module.ComboboxPopup),
);

const PreloadComboboxPopup = Command.make("PreloadFilterPickerPopup", {}, () =>
	Effect.sync(() => {
		void LazyComboboxPopup.preload();
	}).pipe(Effect.as(Component.noop)),
);

const Selection = Schema.NullOr(Schema.String);
const Event = UiSchema.TaggedEnum({ Picked: { value: Selection } });
const Message = UiSchema.TaggedEnum({
	Activated: { focusSearch: Schema.Boolean },
	Picked: { value: Selection },
	PreloadRequested: {},
});

const triggerClass =
	"decoration-accent/60 hover:decoration-accent focus-visible:decoration-accent relative inline-flex max-w-full cursor-pointer items-baseline gap-1 text-left text-accent-text underline decoration-dotted underline-offset-4 after:absolute after:-inset-y-2 after:inset-x-0 after:content-[''] hover:decoration-solid focus-visible:outline-none focus-visible:decoration-solid";

export const Combobox = Html.component({
	name: "FilterPicker",
	props: Schema.Struct({
		value: Selection,
		options: FilterOptions,
		placeholder: Schema.String,
		searchLabel: Schema.String,
		ariaLabel: Schema.String,
	}),
	model: Schema.Struct({
		activated: Schema.Boolean,
		focusSearch: Schema.Boolean,
	}),
	message: Message,
	events: Event,
	restore: false,
}).make({
	init: () => ({ activated: false, focusSearch: false }),
	update: {
		Activated: ($, { focusSearch }) =>
			$.model.activated ? $.model : $.evolve({ activated: true, focusSearch }),
		Picked: ($, { value }) => $.emit(Event.Picked({ value })),
		PreloadRequested: ($) => ($.model.activated ? $.model : $.run(PreloadComboboxPopup.make())),
	},
	view: (h, { activated, focusSearch }) => {
		const { value, options, placeholder, searchLabel, ariaLabel } = h.props;
		const selectedLabel =
			value === null ? placeholder : (getPickerIndex(options).labels.get(value) ?? value);

		const staticTrigger = () =>
			h.div.class("min-w-0").children(
				h.button
					.attrs({
						type: "button",
						role: "combobox",
						"aria-autocomplete": "none",
						"aria-expanded": "false",
						"aria-haspopup": "dialog",
						"aria-label": ariaLabel,
					})
					.class(triggerClass)
					.on("mouseenter", Message.PreloadRequested())
					.on("focus", Message.PreloadRequested())
					.on("click", ({ pointerType }) => Message.Activated({ focusSearch: pointerType === "" }))
					.on(
						"keydown",
						({ key }) =>
							key === "ArrowDown" || key === "ArrowUp"
								? Message.Activated({ focusSearch: true })
								: undefined,
						{ preventDefault: true },
					)
					.children(
						h.span.class("min-w-0 wrap-anywhere text-base").children(selectedLabel),
						value === null && Icon(h, "ChevronDown", 12, "shrink-0 self-center opacity-50"),
					),
			);

		if (!activated) {
			return staticTrigger();
		}

		return LazyComboboxPopup(h, {
			props: { value, options, placeholder, searchLabel, ariaLabel, focusSearch },
			onEmit: { Picked: ({ value: pickedValue }) => Message.Picked({ value: pickedValue }) },
			fallback: () => staticTrigger(),
		});
	},
});
