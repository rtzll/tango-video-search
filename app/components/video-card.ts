import type { View } from "@effect/ui";
import { Toggle } from "@effect/ui-kit";
import type { Html } from "@effect/ui/html";

import {
	isSameResultFilterValue,
	type ResultFilter,
	type SearchFilters,
	type SearchVideo,
} from "../search";
import { Icon } from "./icons";

interface VideoCardProps<Message> {
	video: SearchVideo;
	onFilterClick: (type: ResultFilter, value: string) => Message;
	filters: SearchFilters;
}

export function VideoCard<Message>(
	h: Html.H<Message>,
	{ video, onFilterClick, filters }: VideoCardProps<Message>,
) {
	const thumbnailUrl = `https://i.ytimg.com/vi/${video.id}/hqdefault.jpg`;
	const videoLinkLabel = `Watch ${video.dancers.join(" and ")} dance to ${video.songTitle} by ${video.orchestra} on YouTube`;
	const eventMetadata = getEventMetadata(video.event, video.year);
	const eventYear = eventMetadata?.year ?? null;

	function filterButton(type: ResultFilter, value: string, children: View.Input<Message>) {
		const selected = type === "dancer" ? [filters.dancer1, filters.dancer2] : [filters[type]];
		const active = selected.some((item) => isSameResultFilterValue(type, item, value));
		return FilterButton(h, onFilterClick(type, value), active, children);
	}

	return h.article
		.key(video.id)
		.class("border-border bg-panel flex flex-col overflow-hidden rounded-md border")
		.children(
			h.a
				.attrs({
					href: `https://youtube.com/watch?v=${video.id}`,
					target: "_blank",
					rel: "noopener noreferrer",
					"aria-label": videoLinkLabel,
				})
				.class("bg-panel-hover group relative aspect-video overflow-hidden")
				.children(
					h.img
						.attrs({ src: thumbnailUrl, alt: "", loading: "lazy" })
						.class("h-full w-full object-cover"),
					h.span.class(
						"bg-accent/45 pointer-events-none absolute inset-0 mix-blend-color transition-opacity duration-200 group-hover:opacity-0 group-focus-visible:opacity-0",
					),
					h.span
						.class(
							"border-border bg-bg text-accent-text group-hover:bg-accent-soft group-focus-visible:bg-accent-soft pointer-events-none absolute top-2 right-2 z-10 inline-flex h-7 w-7 items-center justify-center rounded-sm border transition-colors",
						)
						.children(Icon(h, "ArrowTopRight")),
				),
			h.div.class("flex flex-1 flex-col p-4").children(
				h.h2
					.class("flex flex-wrap text-lg leading-snug font-normal")
					.children(
						video.dancers.map((dancer, index) =>
							h.span
								.key(`${video.id}-${dancer}`)
								.children(
									filterButton("dancer", dancer, dancer),
									index < video.dancers.length - 1 && h.span.class("mr-1").children(" and "),
								),
						),
					),
				h.p
					.class("text-muted mt-1 text-sm")
					.children(
						"dancing to ",
						filterButton("song", video.songTitle, video.songTitle),
						" by ",
						filterButton("orchestra", video.orchestra, video.orchestra),
					),
				video.singers.length > 0 &&
					h.p.class("text-muted mt-1 text-sm").children(
						"with vocals by ",
						video.singers.map((singer, index) =>
							h.span
								.key(`${video.id}-${singer}`)
								.children(
									filterButton("singer", singer, singer),
									index < video.singers.length - 1 ? ", " : "",
								),
						),
					),
				h.div.class("min-h-5 flex-1"),
				h.div.class("text-muted grid grid-cols-2 items-end gap-3 text-xs").children(
					h.div
						.class("inline-flex min-w-0 items-baseline gap-1")
						.children(
							h.span.class("shrink-0").children("via"),
							h.span
								.class("min-w-0 [&>button]:block [&>button]:max-w-full")
								.children(
									filterButton(
										"channel",
										video.channelId,
										h.span.class("block truncate").children(video.channelTitle),
									),
								),
						),
					eventMetadata &&
						h.span
							.class("flex min-w-0 items-baseline justify-end gap-1")
							.attr("title", eventMetadata.label)
							.children(
								eventMetadata.kind === "event" &&
									h.span
										.class("min-w-0 [&>button]:block [&>button]:max-w-full")
										.children(
											filterButton(
												"event",
												eventMetadata.event.value,
												h.span.class("block truncate").children(eventMetadata.event.label),
											),
										),
								eventMetadata.kind === "event" &&
									eventYear &&
									h.span.class("shrink-0").children("·"),
								eventYear &&
									h.span.class("shrink-0").children(filterButton("year", eventYear, eventYear)),
							),
				),
			),
		);
}
type EventMetadata =
	| {
			kind: "event";
			event: { label: string; value: string };
			label: string;
			year: string | null;
	  }
	| { kind: "year"; label: string; year: string };

function getEventMetadata(event: string | null, year: number | null): EventMetadata | null {
	const cleanEvent = event?.trim() || null;
	const cleanYear = year ? String(year) : null;
	if (!cleanEvent && !cleanYear) {
		return null;
	}
	const displayEvent =
		cleanEvent && cleanYear
			? cleanEvent.replace(new RegExp(`(?:\\s*[·–—-]?\\s*)${cleanYear}\\s*$`), "").trim() || null
			: cleanEvent;
	if (!displayEvent || !cleanEvent) {
		return cleanYear ? { kind: "year", label: cleanYear, year: cleanYear } : null;
	}
	return {
		event: { label: displayEvent, value: cleanEvent },
		kind: "event",
		label: [displayEvent, cleanYear].filter(Boolean).join(" · "),
		year: cleanYear,
	};
}

function FilterButton<Message>(
	h: Html.H<Message>,
	onClick: Message,
	active: boolean,
	children: View.Input<Message>,
) {
	return Toggle(h, { props: { pressed: active }, onToggle: () => onClick })
		.class(
			"group relative cursor-pointer leading-tight font-normal pointer-coarse:after:absolute pointer-coarse:after:-inset-x-1 pointer-coarse:after:-inset-y-1.5 pointer-coarse:after:content-['']",
			active ? "text-accent-text" : "text-text",
		)
		.children(
			!active &&
				h.span
					.attr("aria-hidden", "true")
					.class(
						"bg-panel-active group-hover:bg-accent-soft pointer-events-none absolute inset-y-0 -inset-x-0.5 z-0 rounded-sm transition-colors",
					),
			h.span.class("relative z-10").children(children),
		);
}
