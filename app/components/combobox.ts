import { Command, Component, Mount, UiSchema } from "@effect/ui";
import { Html, HtmlCommand } from "@effect/ui/html";
import { Effect, Queue, Schema, Stream } from "effect";

import { FilterOptions } from "../search-page-data";
import { normalizeName } from "../utils/normalize";
import { Icon } from "./icons";

const Selection = Schema.NullOr(Schema.String);
const Event = UiSchema.TaggedEnum({ Picked: { value: Selection } });
const Message = UiSchema.TaggedEnum({
	Toggled: {},
	Dismissed: { restoreFocus: Schema.Boolean },
	Typed: { query: Schema.String },
	Highlighted: { index: Schema.Number },
	Picked: { value: Selection },
	Measured: { openAbove: Schema.Boolean },
});

const Trigger = Html.ref("ComboboxTrigger", "button");
type PanelMessage = ReturnType<typeof Message.Dismissed> | ReturnType<typeof Message.Measured>;

const WatchPanel = Mount.makeStream("WatchComboboxPanel", {}, (panel: HTMLDivElement) =>
	Stream.callback<PanelMessage>((queue) =>
		Effect.acquireRelease(
			Effect.sync(() => {
				const container = panel.parentElement;
				const trigger = container?.querySelector("button");
				const document = panel.ownerDocument;
				const window = document.defaultView!;
				const updatePosition = () => {
					const rect = trigger?.getBoundingClientRect();
					if (!rect) return;
					const spaceBelow = window.innerHeight - rect.bottom;
					Queue.offerUnsafe(
						queue,
						Message.Measured({
							openAbove: spaceBelow < panel.offsetHeight + 8 && rect.top > spaceBelow,
						}),
					);
				};
				const dismiss = (event: PointerEvent) => {
					if (!event.composedPath().includes(container!)) {
						Queue.offerUnsafe(queue, Message.Dismissed({ restoreFocus: false }));
					}
				};
				const frame = window.requestAnimationFrame(() => {
					updatePosition();
					panel.querySelector("input")?.focus();
				});
				const observer = new ResizeObserver(updatePosition);
				observer.observe(panel);
				document.addEventListener("pointerdown", dismiss);

				return () => {
					window.cancelAnimationFrame(frame);
					observer.disconnect();
					document.removeEventListener("pointerdown", dismiss);
				};
			}),
			(dispose) => Effect.sync(dispose),
		),
	),
);

const ScrollToOption = Mount.make("ScrollToComboboxOption", {}, (option: HTMLButtonElement) =>
	Effect.sync(() => option.scrollIntoView({ block: "nearest" })).pipe(Effect.as(Component.noop)),
);

const initialModel = {
	open: false,
	openAbove: false,
	query: "",
	activeIndex: null,
};

export const Combobox = Html.component({
	name: "Combobox",
	props: Schema.Struct({
		value: Selection,
		options: FilterOptions,
		placeholder: Schema.String,
		searchLabel: Schema.String,
		ariaLabel: Schema.String,
		listId: Schema.String,
	}),
	model: Schema.Struct({
		open: Schema.Boolean,
		openAbove: Schema.Boolean,
		query: Schema.String,
		activeIndex: Schema.NullOr(Schema.Number),
	}),
	message: Message,
	events: Event,
	restore: false,
}).make({
	init: () => initialModel,
	update: ($, message) => {
		switch (message._tag) {
			case "Toggled":
				return { ...initialModel, open: !$.model.open };
			case "Dismissed":
				if (!message.restoreFocus) return initialModel;
				return $.evolve(initialModel).run(
					HtmlCommand.Focus.make({
						ref: Trigger,
						options: { preventScroll: true },
					}).pipe(Command.asNoop),
				);
			case "Typed":
				return $.evolve({ query: message.query, activeIndex: null });
			case "Highlighted":
				return $.evolve({ activeIndex: message.index });
			case "Measured":
				return $.evolve({ openAbove: message.openAbove });
			case "Picked":
				return $.evolve(initialModel)
					.emit(Event.Picked({ value: message.value }))
					.run(
						HtmlCommand.Focus.make({
							ref: Trigger,
							options: { preventScroll: true },
						}).pipe(Command.asNoop),
					);
		}
	},
	view: (h, { open, openAbove, query, activeIndex }) => {
		const { value, options, placeholder, searchLabel, ariaLabel, listId } = h.props;
		const selectedLabel =
			value === null ? placeholder : (options.find((item) => item.value === value)?.label ?? value);
		const normalizedQuery = normalizeName(query.trim());
		const matches = normalizedQuery
			? options.filter((option) => normalizeName(option.label).includes(normalizedQuery))
			: options;
		const choices = [{ value: null, label: placeholder, count: null }, ...matches];
		const selectedIndex = choices.findIndex((item) => item.value === value);
		const highlighted = Math.min(activeIndex ?? Math.max(selectedIndex, 0), choices.length - 1);
		const optionId = (index: number) => `${listId}-option-${index}`;

		function optionRow(item: (typeof choices)[number], index: number) {
			const active = index === highlighted;
			const selected = item.value === value;
			const button = h.button
				.key(item.value ?? "")
				.attrs({
					type: "button",
					id: optionId(index),
					role: "option",
					"aria-selected": String(selected),
					title: item.count === null ? item.label : `${item.label} · ${item.count}`,
				})
				.on("click", Message.Picked({ value: item.value }))
				.class(
					"hover:bg-panel-hover flex min-h-10 w-full cursor-pointer items-center justify-between rounded-sm px-3 py-2 text-left text-sm",
					active && "bg-panel-hover",
					selected ? "bg-accent-soft text-accent-text font-medium" : "text-text",
				);
			return (active ? button.onMount(ScrollToOption()) : button).children(
				h.span.class("max-w-60 truncate").children(item.label),
				item.count !== null &&
					h.span.class("text-muted shrink-0 text-xs tabular-nums").children(String(item.count)),
			);
		}

		function handleKey(key: string) {
			switch (key) {
				case "ArrowDown":
					return Message.Highlighted({ index: (highlighted + 1) % choices.length });
				case "ArrowUp":
					return Message.Highlighted({
						index: (highlighted + choices.length - 1) % choices.length,
					});
				case "Enter":
					return Message.Picked({ value: choices[highlighted]?.value ?? null });
				case "Escape":
					return Message.Dismissed({ restoreFocus: true });
				default:
					return undefined;
			}
		}

		return h.div.class("static inline-block sm:relative").children(
			h.button
				.ref(Trigger)
				.attrs({
					type: "button",
					"aria-label": ariaLabel,
					"aria-haspopup": "listbox",
					"aria-expanded": String(open),
				})
				.on("click", Message.Toggled())
				.class(
					"decoration-accent/60 hover:decoration-accent focus-visible:decoration-accent relative inline-flex cursor-pointer items-center gap-1 px-0 py-0 text-accent-text underline decoration-dotted underline-offset-4 after:absolute after:-inset-y-2 after:inset-x-0 after:content-[''] hover:decoration-solid focus-visible:outline-none focus-visible:decoration-solid",
				)
				.children(
					h.span.class("truncate text-base").children(selectedLabel),
					value === null && Icon(h, "ChevronDown", 12, "opacity-50"),
				),
			open &&
				h.div
					.onMount(WatchPanel().pipe(Mount.map((message) => message)))
					.class(
						"border-border bg-panel absolute inset-x-0 z-20 min-w-0 rounded-md border p-1 shadow-xl sm:right-auto sm:min-w-70",
						openAbove ? "bottom-full mb-1.5" : "top-full mt-1.5",
					)
					.children(
						h.div.class("flex flex-col gap-2").children(
							h.div.class("relative flex items-center gap-2 px-2 py-2").children(
								Icon(h, "MagnifyingGlass", 15, "text-muted shrink-0"),
								h.input
									.attrs({
										type: "text",
										placeholder: `Search ${searchLabel}`,
										autocomplete: "off",
										"aria-label": `Search ${searchLabel}`,
										role: "combobox",
										"aria-autocomplete": "list",
										"aria-expanded": "true",
										"aria-controls": listId,
										"aria-activedescendant": optionId(highlighted),
									})
									.value(query)
									.on("input", ({ value }) => Message.Typed({ query: value }))
									.on("keydown", ({ key }) => handleKey(key), { preventDefault: true })
									.class(
										"placeholder:text-muted min-w-0 flex-1 bg-transparent py-1 text-base outline-none",
									),
							),
							h.div.class("max-h-80 overflow-y-auto px-1 pb-1").children(
								h.div
									.class("flex flex-col gap-1")
									.attrs({ role: "listbox", id: listId })
									.children(
										optionRow(choices[0]!, 0),
										matches.length > 0 && h.div.class("border-border mx-2 my-1 border-t"),
										matches.length === 0
											? h.p.class("text-muted py-3 text-center text-sm").children("No matches")
											: choices.slice(1).map((item, index) => optionRow(item, index + 1)),
									),
							),
						),
					),
		);
	},
});
