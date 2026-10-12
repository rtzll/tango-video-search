import { css, type Handle } from "remix/component";

import { colors } from "../ui/colors.ts";
interface PopoverPosition {
	left: number;
	top: number;
}

interface PopoverRect {
	bottom: number;
	height: number;
	left: number;
	top: number;
	width: number;
}

interface PickerPopoverOptions {
	closeOnEscape?: boolean;
	onReset: () => void;
	placement: "anchored" | "viewport";
}

const ANCHORED_PLACEMENT_GAP = 8;
const POPOVER_GAP = 6;
export const POPOVER_VIEWPORT_MARGIN = 16;

export function getViewportPopoverPosition(
	triggerRect: PopoverRect,
	panelRect: PopoverRect,
	viewport: { height: number; width: number },
): PopoverPosition {
	const maximumLeft = Math.max(
		POPOVER_VIEWPORT_MARGIN,
		viewport.width - panelRect.width - POPOVER_VIEWPORT_MARGIN,
	);
	const left = Math.min(Math.max(triggerRect.left, POPOVER_VIEWPORT_MARGIN), maximumLeft);
	const spaceBelow = viewport.height - triggerRect.bottom - POPOVER_GAP;
	const spaceAbove = triggerRect.top - POPOVER_GAP;
	const shouldOpenAbove =
		spaceBelow < panelRect.height + POPOVER_VIEWPORT_MARGIN && spaceAbove > spaceBelow;
	const unclampedTop = shouldOpenAbove
		? triggerRect.top - panelRect.height - POPOVER_GAP
		: Math.min(
				triggerRect.bottom + POPOVER_GAP,
				viewport.height - panelRect.height - POPOVER_VIEWPORT_MARGIN,
			);

	return {
		left,
		top: Math.max(POPOVER_VIEWPORT_MARGIN, unclampedTop),
	};
}

export function createPickerPopover<Props, Panel extends HTMLElement>(
	handle: Handle<Props>,
	options: PickerPopoverOptions,
) {
	let container: HTMLElement | undefined;
	let input: HTMLInputElement | undefined;
	let open = false;
	let openAbove = false;
	let panel: Panel | undefined;
	let position: PopoverPosition | null = null;
	let trigger: HTMLButtonElement | undefined;
	let observePanel = (node: Panel | undefined) => {
		panel = node;
	};

	if (typeof document !== "undefined") {
		const handleOutsidePointer = (event: MouseEvent) => {
			if (open && event.target instanceof Node && !container?.contains(event.target)) {
				close();
			}
		};
		const handleEscape = (event: KeyboardEvent) => {
			if (open && options.closeOnEscape && event.key === "Escape") {
				event.preventDefault();
				close(true);
			}
		};
		const handleViewportChange = () => {
			measurePlacement();
		};
		const resizeObserver =
			options.placement === "viewport" && typeof ResizeObserver !== "undefined"
				? new ResizeObserver(measurePlacement)
				: undefined;

		document.addEventListener("mousedown", handleOutsidePointer);
		document.addEventListener("keydown", handleEscape);
		if (options.placement === "viewport") {
			globalThis.addEventListener("resize", handleViewportChange);
			globalThis.addEventListener("scroll", handleViewportChange, true);
		}
		handle.signal.addEventListener(
			"abort",
			() => {
				document.removeEventListener("mousedown", handleOutsidePointer);
				document.removeEventListener("keydown", handleEscape);
				globalThis.removeEventListener("resize", handleViewportChange);
				globalThis.removeEventListener("scroll", handleViewportChange, true);
				resizeObserver?.disconnect();
			},
			{ once: true },
		);
		observePanel = (node) => {
			resizeObserver?.disconnect();
			panel = node;
			if (node) {
				resizeObserver?.observe(node);
			}
		};
	}

	function close(restoreFocus = false) {
		if (!open) {
			return;
		}
		open = false;
		openAbove = false;
		position = null;
		options.onReset();
		void handle.update().then((signal) => {
			if (!signal.aborted && restoreFocus) {
				trigger?.focus({ preventScroll: true });
			}
		});
	}

	function openPicker() {
		open = true;
		openAbove = false;
		position = null;
		options.onReset();
		void handle.update().then((signal) => {
			if (!signal.aborted) {
				input?.focus();
				measurePlacement();
			}
		});
	}

	function measurePlacement() {
		if (!open || !trigger || !panel) {
			return;
		}
		const triggerRect = trigger.getBoundingClientRect();
		if (options.placement === "anchored") {
			const spaceAbove = triggerRect.top;
			const spaceBelow = globalThis.innerHeight - triggerRect.bottom;
			const nextOpenAbove =
				spaceBelow < panel.offsetHeight + ANCHORED_PLACEMENT_GAP && spaceAbove > spaceBelow;
			if (nextOpenAbove !== openAbove) {
				openAbove = nextOpenAbove;
				void handle.update();
			}
			return;
		}

		const panelRect = panel.getBoundingClientRect();
		const nextPosition = getViewportPopoverPosition(triggerRect, panelRect, {
			height: globalThis.innerHeight,
			width: globalThis.innerWidth,
		});
		if (nextPosition.left !== position?.left || nextPosition.top !== position?.top) {
			position = nextPosition;
			void handle.update();
		}
	}

	return {
		close,
		focusInput() {
			input?.focus();
		},
		measurePlacement,
		get open() {
			return open;
		},
		get openAbove() {
			return openAbove;
		},
		openPicker,
		get position() {
			return position;
		},
		setContainer(node: HTMLElement | undefined) {
			container = node;
		},
		setInput(node: HTMLInputElement | undefined) {
			input = node;
		},
		setPanel(node: Panel | undefined) {
			observePanel(node);
		},
		setTrigger(node: HTMLButtonElement | undefined) {
			trigger = node;
		},
	};
}

export const popoverPanelChromeStyle = css({
	backgroundColor: colors.panel,
	border: `1px solid ${colors.border}`,
	borderRadius: "6px",
	boxShadow: `0 20px 25px -5px ${colors.shadow}, 0 8px 10px -6px ${colors.shadow}`,
	padding: "4px",
});

export const popoverSearchStyle = css({
	"& > svg": { color: colors.muted, flexShrink: 0 },
	"& input": {
		background: "transparent",
		border: 0,
		color: colors.text,
		flex: 1,
		fontSize: "16px",
		lineHeight: "24px",
		minWidth: 0,
		outline: 0,
		padding: "4px 0",
	},
	"& input::placeholder": { color: colors.muted, opacity: 1 },
	alignItems: "center",
	display: "flex",
	gap: "8px",
	padding: "8px",
});

export const popoverOptionRowsStyle = css({
	"& > button": {
		alignItems: "center",
		background: "transparent",
		border: 0,
		borderRadius: "4px",
		color: colors.text,
		cursor: "pointer",
		display: "flex",
		fontSize: "14px",
		justifyContent: "space-between",
		lineHeight: "20px",
		minHeight: "40px",
		padding: "8px 12px",
		textAlign: "left",
		width: "100%",
	},
	"& > button > span:first-child": {
		maxWidth: "240px",
		overflow: "hidden",
		textOverflow: "ellipsis",
		whiteSpace: "nowrap",
	},
	"& > button > span:last-child:not(:first-child)": {
		color: colors.muted,
		flexShrink: 0,
		fontSize: "12px",
		fontVariantNumeric: "tabular-nums",
		lineHeight: "16px",
	},
	"& > button:hover": { backgroundColor: colors.panelHover },
});
