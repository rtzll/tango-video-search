import { Cross1Icon, MagnifyingGlassIcon } from "@radix-ui/react-icons";
import * as stylex from "@stylexjs/stylex";
import { Fragment, useCallback, useEffect, useRef, useState } from "react";

import type { FilterOption, SearchFilters, SearchOptions } from "~/search";
import { normalizeName } from "~/utils/normalize";

import { pickerStyles } from "../styles/picker";
import { colors } from "../styles/tokens.stylex";

const advancedFilters = [
	{ key: "song", label: "Song" },
	{ key: "singer", label: "Singer" },
	{ key: "event", label: "Event" },
	{ key: "year", label: "Year" },
	{ key: "channel", label: "Channel" },
] as const;

type AdvancedFilterKey = (typeof advancedFilters)[number]["key"];

interface AdvancedFilterStateProps {
	filters: SearchFilters;
	onFilterChange: <Key extends keyof SearchFilters>(filter: Key, value: SearchFilters[Key]) => void;
	options: SearchOptions;
}

interface AdvancedFiltersProps extends AdvancedFilterStateProps {
	xstyle?: stylex.StyleXStyles;
}

interface PopoverPosition {
	left: number;
	top: number;
}

const VIEWPORT_MARGIN = 16;
const POPOVER_GAP = 6;

function getMatchingOptions(options: readonly FilterOption[], query: string) {
	const normalizedQuery = normalizeName(query.trim());
	return options
		.filter(
			(option) =>
				normalizedQuery.length === 0 || normalizeName(option.label).includes(normalizedQuery),
		)
		.slice(0, 100);
}

function AdvancedFilterPicker({ filters, onFilterChange, options }: AdvancedFilterStateProps) {
	const availableFilters = advancedFilters.filter(
		({ key }) => filters[key] === null && options[key].length > 0,
	);
	const [selectedKey, setSelectedKey] = useState<AdvancedFilterKey>("song");
	const [query, setQuery] = useState("");
	const [open, setOpen] = useState(false);
	const [position, setPosition] = useState<PopoverPosition | null>(null);
	const containerRef = useRef<HTMLDivElement>(null);
	const triggerRef = useRef<HTMLButtonElement>(null);
	const panelRef = useRef<HTMLDivElement>(null);
	const activeFilter =
		availableFilters.find(({ key }) => key === selectedKey) ?? availableFilters[0];
	const hasActiveFilter = advancedFilters.some(({ key }) => filters[key] !== null);

	const close = useCallback((restoreFocus = false) => {
		setOpen(false);
		setPosition(null);
		setQuery("");
		if (restoreFocus) {
			requestAnimationFrame(() => triggerRef.current?.focus());
		}
	}, []);

	const updatePosition = useCallback(() => {
		const trigger = triggerRef.current;
		const panel = panelRef.current;
		if (!trigger || !panel) {
			return;
		}

		const triggerRect = trigger.getBoundingClientRect();
		const panelRect = panel.getBoundingClientRect();
		const maximumLeft = Math.max(
			VIEWPORT_MARGIN,
			globalThis.innerWidth - panelRect.width - VIEWPORT_MARGIN,
		);
		const left = Math.min(Math.max(triggerRect.left, VIEWPORT_MARGIN), maximumLeft);
		const spaceBelow = globalThis.innerHeight - triggerRect.bottom - POPOVER_GAP;
		const spaceAbove = triggerRect.top - POPOVER_GAP;
		const openAbove = spaceBelow < panelRect.height + VIEWPORT_MARGIN && spaceAbove > spaceBelow;
		const top = openAbove
			? Math.max(VIEWPORT_MARGIN, triggerRect.top - panelRect.height - POPOVER_GAP)
			: Math.min(
					triggerRect.bottom + POPOVER_GAP,
					globalThis.innerHeight - panelRect.height - VIEWPORT_MARGIN,
				);

		setPosition({ left, top: Math.max(VIEWPORT_MARGIN, top) });
	}, []);

	useEffect(() => {
		if (!open) {
			return;
		}

		const frame = requestAnimationFrame(updatePosition);
		const observer = new ResizeObserver(updatePosition);
		if (panelRef.current) {
			observer.observe(panelRef.current);
		}
		globalThis.addEventListener("resize", updatePosition);
		globalThis.addEventListener("scroll", updatePosition, true);
		return () => {
			cancelAnimationFrame(frame);
			observer.disconnect();
			globalThis.removeEventListener("resize", updatePosition);
			globalThis.removeEventListener("scroll", updatePosition, true);
		};
	}, [open, updatePosition]);

	useEffect(() => {
		if (!open) {
			return;
		}
		const handlePointerDown = (event: MouseEvent) => {
			if (!containerRef.current?.contains(event.target as Node)) {
				close();
			}
		};
		const handleKeyDown = (event: KeyboardEvent) => {
			if (event.key === "Escape") {
				event.preventDefault();
				close(true);
			}
		};
		document.addEventListener("mousedown", handlePointerDown);
		document.addEventListener("keydown", handleKeyDown);
		return () => {
			document.removeEventListener("mousedown", handlePointerDown);
			document.removeEventListener("keydown", handleKeyDown);
		};
	}, [close, open]);

	useEffect(() => {
		if (open) {
			updatePosition();
		}
	}, [activeFilter?.key, open, query, updatePosition]);

	if (!activeFilter) {
		return null;
	}

	const matchingOptions = getMatchingOptions(options[activeFilter.key], query);

	return (
		<div ref={containerRef} {...stylex.props(styles.picker)}>
			<button
				ref={triggerRef}
				type="button"
				onClick={() => (open ? close() : setOpen(true))}
				aria-expanded={open}
				aria-haspopup="dialog"
				aria-label={
					hasActiveFilter ? "Add another performance detail" : "Choose performance details"
				}
				{...stylex.props(styles.trigger)}
			>
				{hasActiveFilter ? "and…" : "where…"}
			</button>

			{open && (
				<div
					ref={panelRef}
					role="dialog"
					aria-label="Add a filter condition"
					{...stylex.props(
						pickerStyles.panel,
						styles.panel,
						styles.panelPosition(
							position?.left ?? VIEWPORT_MARGIN,
							position?.top ?? VIEWPORT_MARGIN,
						),
						!position && styles.hiddenPanel,
					)}
				>
					<div {...stylex.props(styles.tabs)} role="tablist">
						{availableFilters.map((filter) => (
							<button
								type="button"
								role="tab"
								key={filter.key}
								onClick={() => {
									setSelectedKey(filter.key);
									setQuery("");
								}}
								aria-selected={filter.key === activeFilter.key}
								{...stylex.props(
									styles.tab,
									filter.key === activeFilter.key ? styles.selectedTab : styles.unselectedTab,
								)}
							>
								{filter.label}
							</button>
						))}
					</div>

					<div {...stylex.props(pickerStyles.search, styles.noShrink)}>
						<MagnifyingGlassIcon {...stylex.props(pickerStyles.searchIcon)} />
						<input
							autoFocus
							value={query}
							onChange={(event) => setQuery(event.target.value)}
							placeholder={`Search ${activeFilter.label.toLowerCase()}`}
							aria-label={`Search ${activeFilter.label.toLowerCase()}`}
							{...stylex.props(pickerStyles.input)}
						/>
					</div>

					<div {...stylex.props(styles.options)} role="listbox">
						{matchingOptions.length === 0 ? (
							<p {...stylex.props(pickerStyles.empty)}>No matches</p>
						) : (
							matchingOptions.map((option) => (
								<button
									type="button"
									role="option"
									aria-selected="false"
									key={option.value}
									onClick={() => {
										onFilterChange(activeFilter.key, option.value);
										close();
									}}
									{...stylex.props(pickerStyles.option, styles.option)}
								>
									<span {...stylex.props(pickerStyles.optionLabel)}>{option.label}</span>
									<span {...stylex.props(pickerStyles.count)}>{option.count}</span>
								</button>
							))
						)}
					</div>
				</div>
			)}
		</div>
	);
}

function AdvancedFilters({ xstyle, filters, onFilterChange, options }: AdvancedFiltersProps) {
	const activeFilters = advancedFilters.filter(({ key }) => filters[key] !== null);
	const hasAvailableFilter = advancedFilters.some(
		({ key }) => filters[key] === null && options[key].length > 0,
	);

	if (activeFilters.length === 0 && !hasAvailableFilter) {
		return null;
	}

	return (
		<div {...stylex.props(styles.container, xstyle)}>
			<span>Only show performances</span>
			{activeFilters.length > 0 && <span>where</span>}
			{activeFilters.map(({ key, label }, index) => {
				const value = filters[key];
				if (value === null) {
					return null;
				}
				const selectedLabel = options[key].find((option) => option.value === value)?.label ?? value;

				return (
					<Fragment key={key}>
						{index > 0 && <span>and</span>}
						<button
							type="button"
							onClick={() => onFilterChange(key, null)}
							aria-label={`Remove ${label.toLowerCase()} condition`}
							{...stylex.props(styles.condition)}
						>
							<span {...stylex.props(styles.conditionLabel)}>
								{label.toLowerCase()} is {selectedLabel}
							</span>
							<Cross1Icon width={10} height={10} {...stylex.props(styles.noShrink)} />
						</button>
					</Fragment>
				);
			})}
			<AdvancedFilterPicker filters={filters} onFilterChange={onFilterChange} options={options} />
		</div>
	);
}

export { AdvancedFilters };

const styles = stylex.create({
	condition: {
		alignItems: "center",
		backgroundColor: {
			"@media (hover: hover)": { ":hover": colors.accentSoftHover },
			default: colors.accentSoft,
		},
		borderRadius: "0.25rem",
		color: colors.accentText,
		cursor: "pointer",
		display: "inline-flex",
		fontSize: "0.75rem",
		gap: "0.25rem",
		height: "1.5rem",
		lineHeight: "1rem",
		maxWidth: "100%",
		paddingInline: "0.5rem",
	},
	conditionLabel: {
		maxWidth: "16rem",
		overflow: "hidden",
		textOverflow: "ellipsis",
		whiteSpace: "nowrap",
	},
	container: {
		alignItems: "center",
		color: colors.muted,
		display: "flex",
		flexWrap: "wrap",
		fontSize: "0.875rem",
		gap: "0.5rem",
		lineHeight: "1.75rem",
		position: "relative",
	},
	hiddenPanel: { visibility: "hidden" },
	noShrink: { flexShrink: 0 },
	option: { gap: "0.75rem" },
	options: {
		display: "flex",
		flexDirection: "column",
		gap: "0.25rem",
		minHeight: 0,
		overflowY: "auto",
		paddingBottom: "0.25rem",
		paddingInline: "0.25rem",
	},
	panel: {
		display: "flex",
		flexDirection: "column",
		maxHeight: "min(20rem, calc(100dvh - 2rem))",
		overflow: "hidden",
		position: "fixed",
		width: "min(20rem, calc(100vw - 2rem))",
		zIndex: 30,
	},
	panelPosition: (left: number, top: number) => ({ left, top }),
	picker: { display: "inline-flex" },
	selectedTab: { backgroundColor: colors.accentSoft, color: colors.accentText, fontWeight: 500 },
	tab: {
		borderRadius: "0.25rem",
		cursor: "pointer",
		flexShrink: 0,
		fontSize: "0.75rem",
		lineHeight: "1rem",
		paddingBlock: "0.375rem",
		paddingInline: "0.5rem",
	},
	tabs: {
		display: "flex",
		flexShrink: 0,
		gap: "0.25rem",
		overflowX: "auto",
		paddingInline: "0.25rem",
		paddingTop: "0.25rem",
	},
	trigger: {
		alignItems: "center",
		backgroundColor: {
			"@media (hover: hover)": { ":hover": colors.accentSoft },
			default: "transparent",
		},
		borderColor: colors.border,
		borderRadius: "0.25rem",
		borderStyle: "dashed",
		borderWidth: 1,
		color: colors.accentText,
		cursor: "pointer",
		display: "inline-flex",
		fontSize: "0.75rem",
		gap: "0.25rem",
		height: "1.5rem",
		lineHeight: "1rem",
		paddingInline: "0.5rem",
	},
	unselectedTab: {
		backgroundColor: {
			"@media (hover: hover)": { ":hover": colors.panelHover },
			default: "transparent",
		},
		color: { "@media (hover: hover)": { ":hover": colors.text }, default: colors.muted },
	},
});
