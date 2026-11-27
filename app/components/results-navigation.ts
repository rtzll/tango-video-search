import type { Html } from "@effect/ui/html";

import { Icon } from "./icons";

interface ResultsNavigationProps {
	announce?: boolean;
	ariaLabel: string;
	getPageHref: (nextPage: number) => string;
	page: number;
	resultText: string;
	totalPages: number;
}

const linkClass =
	"border-border text-accent-text inline-flex items-center gap-1 rounded-sm border px-2 py-1 text-xs pointer-coarse:px-3 pointer-coarse:py-2";

export function ResultsNavigation<Message>(
	h: Html.H<Message>,
	{ announce, ariaLabel, getPageHref, page, resultText, totalPages }: ResultsNavigationProps,
) {
	const previous = [Icon(h, "ChevronLeft", 14), "Previous"];
	const next = ["Next", Icon(h, "ChevronRight", 14)];

	return h.div.class("flex flex-wrap items-center justify-between gap-3").children(
		h.span
			.class("text-muted text-sm")
			.attr("aria-live", announce ? "polite" : undefined)
			.children(resultText),
		totalPages > 1 &&
			h.nav
				.class("flex items-center gap-2")
				.attr("aria-label", ariaLabel)
				.children(
					page <= 1
						? h.button
								.attr("type", "button")
								.disabled(true)
								.class(linkClass, "cursor-not-allowed opacity-50")
								.children(previous)
						: h.a
								.attr("href", getPageHref(page - 1))
								.class(linkClass, "hover:bg-accent-soft")
								.children(previous),
					h.span.class("text-muted text-xs").children(`Page ${page} of ${totalPages}`),
					page >= totalPages
						? h.button
								.attr("type", "button")
								.disabled(true)
								.class(linkClass, "cursor-not-allowed opacity-50")
								.children(next)
						: h.a
								.attr("href", getPageHref(page + 1))
								.class(linkClass, "hover:bg-accent-soft")
								.children(next),
				),
	);
}
