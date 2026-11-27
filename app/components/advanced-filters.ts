import { Command, Mount, UiSchema } from "@effect/ui";
import { Html, HtmlCommand } from "@effect/ui/html";
import { Effect, Queue, Schema, Stream } from "effect";

import { FilterOptions } from "../search-page-data";
import { normalizeName } from "../utils/normalize";
import { Icon } from "./icons";

const advancedFilters = [
	{ key: "song", label: "Song" },
	{ key: "singer", label: "Singer" },
	{ key: "event", label: "Event" },
	{ key: "year", label: "Year" },
	{ key: "channel", label: "Channel" },
] as const;

const FilterKey = Schema.Literals(["song", "singer", "event", "year", "channel"]);
const Filter = Schema.NullOr(Schema.String);
const Position = Schema.Struct({ left: Schema.Number, top: Schema.Number });
const Event = UiSchema.TaggedEnum({ Changed: { key: FilterKey, value: Filter } });
const Message = UiSchema.TaggedEnum({
	Toggled: {},
	Dismissed: { restoreFocus: Schema.Boolean },
	SelectedTab: { key: FilterKey },
	Typed: { query: Schema.String },
	Changed: { key: FilterKey, value: Filter },
	Positioned: { position: Position },
});

const VIEWPORT_MARGIN = 16;
const POPOVER_GAP = 6;
const Trigger = Html.ref("AdvancedFilterTrigger", "button");
type PanelMessage = ReturnType<typeof Message.Dismissed> | ReturnType<typeof Message.Positioned>;

const WatchPanel = Mount.makeStream("WatchAdvancedFilterPanel", {}, (panel: HTMLDivElement) =>
	Stream.callback<PanelMessage>((queue) =>
		Effect.acquireRelease(
			Effect.sync(() => {
				const container = panel.parentElement;
				const trigger = container?.querySelector("button");
				const document = panel.ownerDocument;
				const window = document.defaultView!;
				const updatePosition = () => {
					if (!trigger) return;
					const anchor = trigger.getBoundingClientRect();
					const { height, width } = panel.getBoundingClientRect();
					const maximumLeft = Math.max(
						VIEWPORT_MARGIN,
						window.innerWidth - width - VIEWPORT_MARGIN,
					);
					const left = Math.min(Math.max(anchor.left, VIEWPORT_MARGIN), maximumLeft);
					const spaceBelow = window.innerHeight - anchor.bottom - POPOVER_GAP;
					const spaceAbove = anchor.top - POPOVER_GAP;
					const openAbove = spaceBelow < height + VIEWPORT_MARGIN && spaceAbove > spaceBelow;
					const top = openAbove
						? anchor.top - height - POPOVER_GAP
						: Math.min(anchor.bottom + POPOVER_GAP, window.innerHeight - height - VIEWPORT_MARGIN);
					Queue.offerUnsafe(
						queue,
						Message.Positioned({ position: { left, top: Math.max(VIEWPORT_MARGIN, top) } }),
					);
				};
				const dismiss = (event: PointerEvent) => {
					if (!event.composedPath().includes(container!)) {
						Queue.offerUnsafe(queue, Message.Dismissed({ restoreFocus: false }));
					}
				};
				const escape = (event: KeyboardEvent) => {
					if (event.key === "Escape") {
						event.preventDefault();
						Queue.offerUnsafe(queue, Message.Dismissed({ restoreFocus: true }));
					}
				};
				const frame = window.requestAnimationFrame(() => {
					updatePosition();
					panel.querySelector("input")?.focus();
				});
				const observer = new ResizeObserver(updatePosition);
				observer.observe(panel);
				window.addEventListener("resize", updatePosition);
				window.addEventListener("scroll", updatePosition, true);
				document.addEventListener("pointerdown", dismiss);
				document.addEventListener("keydown", escape);

				return () => {
					window.cancelAnimationFrame(frame);
					observer.disconnect();
					window.removeEventListener("resize", updatePosition);
					window.removeEventListener("scroll", updatePosition, true);
					document.removeEventListener("pointerdown", dismiss);
					document.removeEventListener("keydown", escape);
				};
			}),
			(dispose) => Effect.sync(dispose),
		),
	),
);

const closed = { open: false, query: "", position: null };

export const AdvancedFilters = Html.component({
	name: "AdvancedFilters",
	props: Schema.Struct({
		filters: Schema.Struct({
			song: Filter,
			singer: Filter,
			event: Filter,
			year: Filter,
			channel: Filter,
		}),
		options: Schema.Struct({
			song: FilterOptions,
			singer: FilterOptions,
			event: FilterOptions,
			year: FilterOptions,
			channel: FilterOptions,
		}),
	}),
	model: Schema.Struct({
		selectedKey: FilterKey,
		query: Schema.String,
		open: Schema.Boolean,
		position: Schema.NullOr(Position),
	}),
	message: Message,
	events: Event,
	restore: false,
}).make({
	init: () => ({ ...closed, selectedKey: "song" }),
	update: ($, message) => {
		switch (message._tag) {
			case "Toggled":
				return $.evolve({ ...closed, open: !$.model.open });
			case "Dismissed":
				if (!message.restoreFocus) return $.evolve(closed);
				return $.evolve(closed).run(HtmlCommand.Focus.make({ ref: Trigger }).pipe(Command.asNoop));
			case "SelectedTab":
				return $.evolve({ selectedKey: message.key, query: "" });
			case "Typed":
				return $.evolve({ query: message.query });
			case "Changed":
				return $.evolve(closed).emit(Event.Changed({ key: message.key, value: message.value }));
			case "Positioned":
				return $.evolve({ position: message.position });
		}
	},
	view: (h, { selectedKey, query, open, position }) => {
		const { filters, options } = h.props;
		const activeFilters = advancedFilters.filter(({ key }) => filters[key] !== null);
		const available = advancedFilters.filter(
			({ key }) => filters[key] === null && options[key].length > 0,
		);
		if (activeFilters.length === 0 && available.length === 0) return h.text("");

		const activeTab = available.find(({ key }) => key === selectedKey) ?? available[0];
		const hasFilters = activeFilters.length > 0;

		function panel(tab: (typeof advancedFilters)[number]) {
			const normalizedQuery = normalizeName(query.trim());
			const matchingOptions = options[tab.key]
				.filter((option) => normalizeName(option.label).includes(normalizedQuery))
				.slice(0, 100);

			return h.div
				.onMount(WatchPanel().pipe(Mount.map((message) => message)))
				.attrs({
					role: "dialog",
					"aria-label": "Add a filter condition",
				})
				.style(
					position
						? { left: `${position.left}px`, top: `${position.top}px` }
						: { left: `${VIEWPORT_MARGIN}px`, top: `${VIEWPORT_MARGIN}px`, visibility: "hidden" },
				)
				.class(
					"border-border bg-panel fixed z-30 flex max-h-[min(20rem,calc(100dvh-2rem))] w-[min(20rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-md border p-1 shadow-xl",
				)
				.children(
					h.div
						.class("flex shrink-0 gap-1 overflow-x-auto px-1 pt-1")
						.attr("role", "tablist")
						.children(
							available.map(({ key, label }) =>
								h.button
									.key(key)
									.attrs({
										type: "button",
										role: "tab",
										"aria-selected": String(key === tab.key),
									})
									.on("click", Message.SelectedTab({ key }))
									.class(
										"shrink-0 cursor-pointer rounded-sm px-2 py-1.5 text-xs",
										key === tab.key
											? "bg-accent-soft text-accent-text font-medium"
											: "text-muted hover:bg-panel-hover hover:text-text",
									)
									.children(label),
							),
						),
					h.div.class("relative flex shrink-0 items-center gap-2 px-2 py-2").children(
						Icon(h, "MagnifyingGlass", 15, "text-muted shrink-0"),
						h.input
							.value(query)
							.attrs({
								placeholder: `Search ${tab.label.toLowerCase()}`,
								"aria-label": `Search ${tab.label.toLowerCase()}`,
							})
							.on("input", ({ value }) => Message.Typed({ query: value }))
							.class(
								"placeholder:text-muted min-w-0 flex-1 bg-transparent py-1 text-base outline-none",
							),
					),
					h.div
						.class("flex min-h-0 flex-col gap-1 overflow-y-auto px-1 pb-1")
						.attr("role", "listbox")
						.children(
							matchingOptions.length === 0
								? h.p.class("text-muted py-3 text-center text-sm").children("No matches")
								: matchingOptions.map((option) =>
										h.button
											.key(option.value)
											.attrs({
												type: "button",
												role: "option",
												"aria-selected": "false",
											})
											.on("click", Message.Changed({ key: tab.key, value: option.value }))
											.class(
												"hover:bg-panel-hover text-text flex min-h-10 w-full cursor-pointer items-center justify-between gap-3 rounded-sm px-3 py-2 text-left text-sm",
											)
											.children(
												h.span.class("max-w-60 truncate").children(option.label),
												h.span
													.class("text-muted shrink-0 text-xs tabular-nums")
													.children(String(option.count)),
											),
									),
						),
				);
		}

		return h.div
			.class("text-muted relative flex flex-wrap items-center gap-2 text-sm leading-7 mt-3 sm:mt-2")
			.children(
				h.span("Only show performances"),
				hasFilters && h.span("where"),
				activeFilters.flatMap(({ key, label }, index) => {
					const value = filters[key];
					if (value === null) return [];
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
				activeTab &&
					h.div.class("inline-flex").children(
						h.button
							.ref(Trigger)
							.attrs({
								type: "button",
								"aria-expanded": String(open),
								"aria-haspopup": "dialog",
								"aria-label": hasFilters
									? "Add another performance detail"
									: "Choose performance details",
							})
							.on("click", Message.Toggled())
							.class(
								"border-border hover:bg-accent-soft text-accent-text inline-flex h-6 cursor-pointer items-center gap-1 rounded-sm border border-dashed px-2 text-xs relative pointer-coarse:after:absolute pointer-coarse:after:-inset-1.5 pointer-coarse:after:content-['']",
							)
							.children(hasFilters ? "and…" : "where…"),
						open && panel(activeTab),
					),
			);
	},
});
