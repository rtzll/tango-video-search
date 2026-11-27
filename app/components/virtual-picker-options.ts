import type { View } from "@effect/ui";
import { type ComboboxItem, VirtualList, VirtualListScrollTarget } from "@effect/ui-kit";
import type { Html } from "@effect/ui/html";

import { getVirtualListMeta } from "./picker-options";

const rowHeight = 40;
const rowGap = 4;
const dividerHeight = 9;
const initialPickerRows = 16;
const pickerOverscan = 12;
export const virtualizationThreshold = 80;

type Div<Message> = Html.Element<Message, never, Html.EventsOf<"div">, HTMLDivElement, "div">;

interface VirtualPickerOptionsProps<Message> {
	items: readonly ComboboxItem[];
	highlighted: string | null;
	scrollRevision: number;
	resetScroll: boolean;
	divider?: boolean;
	viewport: Div<Message>;
	wrapList?: (list: Div<Message>) => View.Input<Message>;
	row: (item: ComboboxItem) => Div<Message>;
	option: (element: Div<Message>, value: string) => Div<Message>;
}

export function VirtualPickerOptions<Message>(
	h: Html.H<Message>,
	{
		items,
		highlighted,
		scrollRevision,
		resetScroll,
		divider,
		viewport,
		wrapList,
		row,
		option,
	}: VirtualPickerOptionsProps<Message>,
) {
	const meta = getVirtualListMeta(items);
	const activeIndex = highlighted === null ? -1 : (meta.indexByValue.get(highlighted) ?? -1);
	const scrollTarget = resetScroll
		? scrollRevision > 0
			? VirtualListScrollTarget.Offset({ offset: 0 })
			: activeIndex > 0
				? VirtualListScrollTarget.Index({ index: activeIndex })
				: undefined
		: activeIndex !== -1
			? VirtualListScrollTarget.Index({ index: activeIndex })
			: undefined;

	return VirtualList(h, {
		props: {
			initialCount: initialPickerRows,
			itemSize: rowHeight + rowGap,
			keys: meta.keys,
			layout: "absolute",
			measure: false,
			overscan: pickerOverscan,
			scrollTo: scrollTarget
				? { align: "nearest", id: scrollRevision, target: scrollTarget }
				: undefined,
			...(divider ? { sizes: meta.dividerSizes(rowHeight, rowGap, dividerHeight) } : {}),
		},
		view: (list) => {
			// Focus stays on the input, so keep its active descendant mounted offscreen.
			const indexes =
				activeIndex !== -1 && !list.items.includes(activeIndex)
					? [...list.items, activeIndex].toSorted((a, b) => a - b)
					: list.items;
			const rows = list.list(h.div.attr("role", "presentation").class("shrink-0")).children(
				indexes.map((index) => {
					const item = items[index]!;
					const hasDivider = divider && index === 0;
					const element = h.div
						.class("group pointer-events-none", hasDivider ? "pb-2" : "pb-1")
						.children(
							row(item),
							hasDivider &&
								h.div.class("border-border mx-2 mt-2 border-t").attr("aria-hidden", "true"),
						);
					return list.item({ element: option(element, item.value), index });
				}),
			);
			return list.viewport(viewport).children(wrapList ? wrapList(rows) : rows);
		},
	});
}
