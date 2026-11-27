import { Component, UiSchema } from "@effect/ui";
import { Html } from "@effect/ui/html";
import { Schema } from "effect";

import { FilterOptions } from "../search";
import { Icon } from "./icons";
import { getPickerIndex } from "./picker-options";

const LazyComboboxPopup = Component.lazy("FilterPickerPopup", () =>
	import("./combobox-popup").then((module) => module.ComboboxPopup),
);

const Selection = Schema.NullOr(Schema.String);
const Event = UiSchema.TaggedEnum({ Picked: { value: Selection } });
const Message = UiSchema.TaggedEnum({
	Activated: {},
	Picked: { value: Selection },
});

const triggerClass =
	"decoration-accent/60 hover:decoration-accent focus-visible:decoration-accent relative inline-flex cursor-pointer items-center gap-1 px-0 py-0 text-accent-text underline decoration-dotted underline-offset-4 after:absolute after:-inset-y-2 after:inset-x-0 after:content-[''] hover:decoration-solid focus-visible:outline-none focus-visible:decoration-solid";

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
	}),
	message: Message,
	events: Event,
	restore: false,
}).make({
	init: () => ({ activated: false }),
	update: {
		Activated: ($) => ($.model.activated ? $.model : $.evolve({ activated: true })),
		Picked: ($, { value }) => $.emit(Event.Picked({ value })),
	},
	view: (h, { activated }) => {
		const { value, options, placeholder, searchLabel, ariaLabel } = h.props;
		const selectedLabel =
			value === null ? placeholder : (getPickerIndex(options).labels.get(value) ?? value);

		const staticTrigger = () =>
			h.div.class("static inline-block sm:relative").children(
				h.span.attr("aria-hidden", "true").class("pointer-events-none absolute inset-0"),
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
					.on("click", Message.Activated())
					.on(
						"keydown",
						({ key }) =>
							key === "ArrowDown" || key === "ArrowUp" ? Message.Activated() : undefined,
						{ preventDefault: true },
					)
					.children(
						h.span.class("truncate text-base").children(selectedLabel),
						value === null && Icon(h, "ChevronDown", 12, "opacity-50"),
					),
			);

		if (!activated) {
			return staticTrigger();
		}

		return LazyComboboxPopup(h, {
			props: { value, options, placeholder, searchLabel, ariaLabel },
			onEmit: { Picked: ({ value: pickedValue }) => Message.Picked({ value: pickedValue }) },
			fallback: () => staticTrigger(),
		});
	},
});
