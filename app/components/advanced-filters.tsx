import { Cross1Icon, MagnifyingGlassIcon, PlusIcon } from "@radix-ui/react-icons";
import { Fragment, useCallback, useEffect, useRef, useState, type CSSProperties } from "react";

import type { FilterOption, SearchFilters, SearchOptions } from "~/search";
import { normalizeName } from "~/utils/normalize";

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
	className?: string;
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
	const panelStyle: CSSProperties = position
		? { left: position.left, top: position.top }
		: { left: VIEWPORT_MARGIN, top: VIEWPORT_MARGIN, visibility: "hidden" };

	return (
		<div ref={containerRef} className="inline-flex">
			<button
				ref={triggerRef}
				type="button"
				onClick={() => (open ? close() : setOpen(true))}
				aria-expanded={open}
				aria-haspopup="dialog"
				className="border-border hover:bg-accent-soft text-accent-text inline-flex h-6 cursor-pointer items-center gap-1 rounded-sm border border-dashed px-2 text-xs"
			>
				<PlusIcon /> condition
			</button>

			{open && (
				<div
					ref={panelRef}
					role="dialog"
					aria-label="Add a filter condition"
					style={panelStyle}
					className="border-border bg-panel fixed z-30 flex max-h-[min(20rem,calc(100dvh-2rem))] w-[min(20rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-md border p-1 shadow-xl"
				>
					<div className="flex shrink-0 gap-1 overflow-x-auto px-1 pt-1" role="tablist">
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
								className={`shrink-0 cursor-pointer rounded-sm px-2 py-1.5 text-xs ${
									filter.key === activeFilter.key
										? "bg-accent-soft text-accent-text font-medium"
										: "text-muted hover:bg-panel-hover hover:text-text"
								}`}
							>
								{filter.label}
							</button>
						))}
					</div>

					<div className="relative flex shrink-0 items-center gap-2 px-2 py-2">
						<MagnifyingGlassIcon className="text-muted shrink-0" />
						<input
							autoFocus
							value={query}
							onChange={(event) => setQuery(event.target.value)}
							placeholder={`Search ${activeFilter.label.toLowerCase()}`}
							aria-label={`Search ${activeFilter.label.toLowerCase()}`}
							className="placeholder:text-muted min-w-0 flex-1 bg-transparent py-1 text-base outline-none"
						/>
					</div>

					<div className="flex min-h-0 flex-col gap-1 overflow-y-auto px-1 pb-1" role="listbox">
						{matchingOptions.length === 0 ? (
							<p className="text-muted py-3 text-center text-sm">No matches</p>
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
									className="hover:bg-panel-hover text-text flex min-h-10 w-full cursor-pointer items-center justify-between gap-3 rounded-sm px-3 py-2 text-left text-sm"
								>
									<span className="max-w-60 truncate">{option.label}</span>
									<span className="text-muted shrink-0 text-xs tabular-nums">{option.count}</span>
								</button>
							))
						)}
					</div>
				</div>
			)}
		</div>
	);
}

function AdvancedFilters({ className, filters, onFilterChange, options }: AdvancedFiltersProps) {
	const activeFilters = advancedFilters.filter(({ key }) => filters[key] !== null);
	const hasAvailableFilter = advancedFilters.some(
		({ key }) => filters[key] === null && options[key].length > 0,
	);

	if (activeFilters.length === 0 && !hasAvailableFilter) {
		return null;
	}

	return (
		<div
			className={`text-muted relative flex flex-wrap items-center gap-2 text-sm leading-7 ${className ?? ""}`}
		>
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
							className="bg-accent-soft hover:bg-accent-soft-hover text-accent-text inline-flex h-6 max-w-full cursor-pointer items-center gap-1 rounded-sm px-2 text-xs"
						>
							<span className="max-w-64 truncate">
								{label.toLowerCase()} is {selectedLabel}
							</span>
							<Cross1Icon width={10} height={10} className="shrink-0" />
						</button>
					</Fragment>
				);
			})}
			<AdvancedFilterPicker filters={filters} onFilterChange={onFilterChange} options={options} />
		</div>
	);
}

export { AdvancedFilters };
