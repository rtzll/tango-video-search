import { type ComboboxItem, VirtualList, VirtualListScrollTarget } from "@effect/ui-kit";
import type { Html } from "@effect/ui/html";

const rowHeight = 40;
const rowGap = 4;
const dividerHeight = 9;
export const initialPickerRows = 12;

type Div<Message> = Html.Element<Message, never, Html.EventsOf<"div">, HTMLDivElement, "div">;

interface VirtualPickerOptionsProps<Message> {
	items: ReadonlyArray<ComboboxItem>;
	highlighted: string | null;
	query: string;
	scrollRevision: number;
	resetScroll: boolean;
	divider?: boolean;
	row: (item: ComboboxItem) => Div<Message>;
	option: (element: Div<Message>, value: string) => Div<Message>;
}

export function VirtualPickerOptions<Message>(
	h: Html.H<Message>,
	{
		items,
		highlighted,
		query,
		scrollRevision,
		resetScroll,
		divider,
		row,
		option,
	}: VirtualPickerOptionsProps<Message>,
) {
	const activeIndex = items.findIndex((item) => item.value === highlighted);
	const scrollTarget =
		activeIndex === -1
			? resetScroll && VirtualListScrollTarget.Offset({ offset: 0 })
			: VirtualListScrollTarget.Index({ index: activeIndex });
	return VirtualList(h, {
		props: {
			dataset: query,
			initialCount: initialPickerRows,
			itemSize: rowHeight + rowGap,
			keys: items.map((item) => item.value),
			layout: "absolute",
			scrollContainer: "nearest",
			scrollTo: scrollTarget
				? { align: "nearest", id: scrollRevision, target: scrollTarget }
				: undefined,
			// Count the divider and gaps until the kit measures the rows.
			sizes: items.map((_, index) => {
				if (divider && index === 0) return rowHeight + rowGap * 2 + dividerHeight;
				return index === items.length - 1 ? rowHeight : rowHeight + rowGap;
			}),
		},
		view: (list) => {
			// Focus stays on the input, so keep its active descendant mounted offscreen.
			const indexes =
				activeIndex !== -1 && !list.items.includes(activeIndex)
					? [...list.items, activeIndex].sort((a, b) => a - b)
					: list.items;
			return list.list(h.div.attr("role", "presentation").class("shrink-0")).children(
				indexes.map((index) => {
					const item = items[index]!;
					const hasDivider = divider && index === 0;
					const element = h.div
						.class(
							"group pointer-events-none",
							hasDivider ? "pb-2" : index < items.length - 1 && "pb-1",
						)
						.children(
							row(item),
							hasDivider &&
								h.div.class("border-border mx-2 mt-2 border-t").attr("aria-hidden", "true"),
						);
					return list.item({ element: option(element, item.value), index });
				}),
			);
		},
	});
}
