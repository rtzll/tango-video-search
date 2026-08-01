import { ChevronDownIcon, MagnifyingGlassIcon } from "@radix-ui/react-icons";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";

import type { FilterOption } from "~/search";
import { normalizeName } from "~/utils/normalize";

type ListItem<Value extends string> =
	| { kind: "empty"; label: string }
	| { kind: "option"; option: FilterOption<Value> };

interface ComboboxProps<Value extends string> {
	value: Value | null;
	onValueChange: (value: Value | null) => void;
	options: readonly FilterOption<Value>[];
	placeholder: string;
	searchLabel: string;
	ariaLabel?: string;
	includeEmptyOption?: boolean;
	showCaret?: boolean;
}

const Combobox = <Value extends string>({
	value,
	onValueChange,
	options,
	placeholder,
	searchLabel,
	ariaLabel,
	includeEmptyOption = true,
	showCaret = true,
}: ComboboxProps<Value>) => {
	const [open, setOpen] = useState(false);
	const [openAbove, setOpenAbove] = useState(false);
	const [query, setQuery] = useState("");
	const [activeIndex, setActiveIndex] = useState(0);
	const triggerRef = useRef<HTMLButtonElement>(null);
	const containerRef = useRef<HTMLDivElement>(null);
	const inputRef = useRef<HTMLInputElement>(null);
	const panelRef = useRef<HTMLDivElement>(null);
	const optionRefs = useRef<(HTMLButtonElement | null)[]>([]);
	const listId = useId();

	const closeCombobox = useCallback(() => {
		inputRef.current?.blur();
		setOpen(false);
	}, []);

	useEffect(() => {
		if (open) {
			setQuery("");
			requestAnimationFrame(() => inputRef.current?.focus());
		}
	}, [open]);

	useEffect(() => {
		if (!open) {
			return;
		}
		const handlePointerDown = (event: MouseEvent) => {
			if (!containerRef.current?.contains(event.target as Node)) {
				closeCombobox();
			}
		};
		document.addEventListener("mousedown", handlePointerDown);
		return () => document.removeEventListener("mousedown", handlePointerDown);
	}, [closeCombobox, open]);

	const filteredOptions = useMemo(() => {
		const normalizedQuery = normalizeName(query.trim());
		if (!normalizedQuery) {
			return options;
		}
		return options.filter((option) => normalizeName(option.label).includes(normalizedQuery));
	}, [options, query]);

	const listOptions = useMemo<ListItem<Value>[]>(() => {
		const optionItems = filteredOptions.map(
			(option): ListItem<Value> => ({ kind: "option", option }),
		);
		return includeEmptyOption
			? [{ kind: "empty", label: placeholder }, ...optionItems]
			: optionItems;
	}, [filteredOptions, includeEmptyOption, placeholder]);

	useEffect(() => {
		if (!open) {
			setOpenAbove(false);
			return;
		}

		const triggerRect = triggerRef.current?.getBoundingClientRect();
		const panelHeight = panelRef.current?.offsetHeight;
		if (!triggerRect || !panelHeight) {
			return;
		}

		const spaceAbove = triggerRect.top;
		const spaceBelow = globalThis.innerHeight - triggerRect.bottom;
		setOpenAbove(spaceBelow < panelHeight + 8 && spaceAbove > spaceBelow);
	}, [filteredOptions.length, open]);

	useEffect(() => {
		if (!open) {
			return;
		}
		const selectedIndex = listOptions.findIndex((item) =>
			item.kind === "empty" ? value === null : item.option.value === value,
		);
		setActiveIndex(selectedIndex !== -1 ? selectedIndex : 0);
	}, [open, listOptions, value]);

	useEffect(() => {
		const activeOption = optionRefs.current[activeIndex];
		activeOption?.scrollIntoView({ block: "nearest" });
	}, [activeIndex]);

	const closeAndRestoreFocus = () => {
		closeCombobox();
		requestAnimationFrame(() => triggerRef.current?.focus({ preventScroll: true }));
	};

	const handleSelect = (nextValue: Value | null) => {
		onValueChange(nextValue);
		closeAndRestoreFocus();
	};

	const selectedOption = options.find((option) => option.value === value);
	const selectedLabel = value === null ? placeholder : (selectedOption?.label ?? value);
	const activeOptionId = listOptions.length > 0 ? `${listId}-option-${activeIndex}` : undefined;
	const panelPosition = openAbove ? "bottom-full mb-1.5" : "top-full mt-1.5";

	return (
		<div ref={containerRef} className="static inline-block sm:relative">
			<button
				type="button"
				ref={triggerRef}
				onClick={() => setOpen((currentOpen) => !currentOpen)}
				aria-label={ariaLabel ?? selectedLabel}
				aria-haspopup="listbox"
				aria-expanded={open}
				className="decoration-accent/60 hover:decoration-accent focus-visible:decoration-accent relative inline-flex cursor-pointer items-center gap-1 px-0 py-0 text-accent-text underline decoration-dotted underline-offset-4 after:absolute after:-inset-y-2 after:inset-x-0 after:content-[''] hover:decoration-solid focus-visible:outline-none focus-visible:decoration-solid"
			>
				<span className="truncate text-base">{selectedLabel}</span>
				{showCaret && value === null && (
					<ChevronDownIcon className="opacity-50" width={12} height={12} />
				)}
			</button>

			{open && (
				<div
					ref={panelRef}
					className={`border-border bg-panel absolute inset-x-0 z-20 min-w-0 rounded-md border p-1 shadow-xl sm:right-auto sm:min-w-70 ${panelPosition}`}
				>
					<div className="flex flex-col gap-2">
						<div className="relative flex items-center gap-2 px-2 py-2">
							<MagnifyingGlassIcon className="text-muted shrink-0" />
							<input
								ref={inputRef}
								type="text"
								value={query}
								onChange={(event) => {
									setQuery(event.target.value);
									setActiveIndex(0);
								}}
								placeholder={`Search ${searchLabel}`}
								autoComplete="off"
								aria-label={`Search ${searchLabel}`}
								role="combobox"
								aria-autocomplete="list"
								aria-expanded={open}
								aria-controls={listId}
								aria-activedescendant={activeOptionId}
								className="placeholder:text-muted min-w-0 flex-1 bg-transparent py-1 text-base outline-none"
								onKeyDown={(event) => {
									if (event.key === "ArrowDown") {
										event.preventDefault();
										setActiveIndex((index) => (index + 1 >= listOptions.length ? 0 : index + 1));
										return;
									}
									if (event.key === "ArrowUp") {
										event.preventDefault();
										setActiveIndex((index) => (index - 1 < 0 ? listOptions.length - 1 : index - 1));
										return;
									}
									if (event.key === "Enter") {
										event.preventDefault();
										const option = listOptions[activeIndex];
										if (option) {
											handleSelect(option.kind === "empty" ? null : option.option.value);
										}
										return;
									}
									if (event.key === "Escape") {
										event.preventDefault();
										closeAndRestoreFocus();
									}
								}}
							/>
						</div>

						<div className="max-h-80 overflow-y-auto px-1 pb-1">
							<div className="flex flex-col gap-1" role="listbox" id={listId}>
								{includeEmptyOption && (
									<OptionRow
										kind="empty"
										id={`${listId}-option-0`}
										label={placeholder}
										selected={value === null}
										active={activeIndex === 0}
										onSelect={() => handleSelect(null)}
										buttonRef={(node) => {
											optionRefs.current[0] = node;
										}}
									/>
								)}
								{includeEmptyOption && filteredOptions.length > 0 && (
									<div className="border-border mx-2 my-1 border-t" />
								)}
								{filteredOptions.length === 0 ? (
									<p className="text-muted py-3 text-center text-sm">No matches</p>
								) : (
									filteredOptions.map((option, index) => {
										const optionIndex = index + (includeEmptyOption ? 1 : 0);
										return (
											<OptionRow
												kind="option"
												key={option.value}
												id={`${listId}-option-${optionIndex}`}
												label={option.label}
												count={option.count}
												selected={option.value === value}
												active={activeIndex === optionIndex}
												onSelect={() => handleSelect(option.value)}
												buttonRef={(node) => {
													optionRefs.current[optionIndex] = node;
												}}
											/>
										);
									})
								)}
							</div>
						</div>
					</div>
				</div>
			)}
		</div>
	);
};

interface OptionRowBaseProps {
	id: string;
	label: string;
	selected: boolean;
	active: boolean;
	onSelect: () => void;
	buttonRef: (node: HTMLButtonElement | null) => void;
}

type OptionRowProps = OptionRowBaseProps & ({ kind: "empty" } | { kind: "option"; count: number });

const OptionRow = (props: OptionRowProps) => (
	<button
		type="button"
		id={props.id}
		ref={props.buttonRef}
		onClick={props.onSelect}
		role="option"
		aria-selected={props.selected}
		title={props.kind === "option" ? `${props.label} (${props.count})` : props.label}
		className={`hover:bg-panel-hover flex min-h-10 w-full cursor-pointer items-center justify-between rounded-sm px-3 py-2 text-left text-sm ${
			props.active ? "bg-panel-hover" : ""
		} ${props.selected ? "bg-accent-soft text-accent-text font-medium" : "text-text"}`}
	>
		<span className="max-w-60 truncate">{props.label}</span>
		{props.kind === "option" && <span className="text-muted shrink-0">({props.count})</span>}
	</button>
);

export { Combobox };
