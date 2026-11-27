import type { Html } from "@effect/ui/html";

import type { SearchFilters, SearchOptions } from "../search";
import { AdvancedFilters } from "./advanced-filters";
import { Combobox } from "./combobox";
import { Icon } from "./icons";

interface SearchControlsProps<Message> {
	filters: SearchFilters;
	onFilterChange: (key: keyof SearchFilters, value: string | null) => Message;
	onReset: Message;
	options: SearchOptions;
}

export function SearchControls<Message>(
	h: Html.H<Message>,
	{ filters, onFilterChange, onReset, options }: SearchControlsProps<Message>,
) {
	const hasAnyFilters = Object.values(filters).some((value) => value !== null);
	function combobox(
		key: "dancer1" | "dancer2" | "orchestra",
		searchLabel: string,
		ariaLabel: string,
	) {
		return Combobox(h, {
			key,
			props: {
				value: filters[key],
				options: options[key],
				placeholder: `any ${searchLabel}`,
				searchLabel,
				ariaLabel,
				listId: `search-${key}-options`,
			},
			onEmit: { Picked: ({ value }) => onFilterChange(key, value) },
		});
	}
	return [
		h.div.class("relative flex flex-wrap items-baseline gap-2").children(
			h.span("I want to see"),
			combobox("dancer1", "dancer", "Select first dancer"),
			h.span("and"),
			combobox("dancer2", "dancer", "Select second dancer"),
			h.span("dance to"),
			combobox("orchestra", "orchestra", "Select orchestra"),
			hasAnyFilters &&
				h.button
					.attrs({ type: "button", "aria-label": "Reset filters" })
					.on("click", onReset)
					.class(
						"bg-accent-soft hover:bg-accent-soft-hover text-accent-text inline-flex h-6 w-6 cursor-pointer items-center justify-center rounded-sm relative pointer-coarse:after:absolute pointer-coarse:after:-inset-1.5 pointer-coarse:after:content-['']",
					)
					.children(Icon(h, "Reset", 12)),
		),
		AdvancedFilters(h, {
			props: { filters, options },
			onEmit: { Changed: ({ key, value }) => onFilterChange(key, value) },
		}),
	];
}
