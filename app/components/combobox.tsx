import { ChevronDownIcon, MagnifyingGlassIcon } from "@radix-ui/react-icons";
import { useEffect, useId, useMemo, useRef, useState } from "react";

import { normalizeName } from "~/utils/normalize";

interface Option {
	id: number;
	name: string;
	count: number;
}

interface ComboboxProps {
	value: string;
	onValueChange: (value: string) => void;
	options: Option[];
	placeholder: string;
	searchLabel: string;
	ariaLabel?: string;
}

const Combobox = ({
	value,
	onValueChange,
	options,
	placeholder,
	searchLabel,
	ariaLabel,
}: ComboboxProps) => {
	const [open, setOpen] = useState(false);
	const [query, setQuery] = useState("");
	const [activeIndex, setActiveIndex] = useState(0);
	const triggerRef = useRef<HTMLButtonElement>(null);
	const containerRef = useRef<HTMLDivElement>(null);
	const inputRef = useRef<HTMLInputElement>(null);
	const optionRefs = useRef<(HTMLButtonElement | null)[]>([]);
	const listId = useId();

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
				setOpen(false);
			}
		};
		document.addEventListener("mousedown", handlePointerDown);
		return () => document.removeEventListener("mousedown", handlePointerDown);
	}, [open]);

	const filteredOptions = useMemo(() => {
		const normalizedQuery = normalizeName(query.trim());
		if (!normalizedQuery) {
			return options;
		}
		return options.filter((option) => normalizeName(option.name).includes(normalizedQuery));
	}, [options, query]);

	const listOptions = useMemo(
		() => [{ count: undefined, id: "any", name: placeholder }, ...filteredOptions],
		[filteredOptions, placeholder],
	);

	useEffect(() => {
		if (!open) {
			return;
		}
		const selectedIndex = listOptions.findIndex((option) =>
			option.id === "any" ? value === "any" : normalizeName(option.name) === normalizeName(value),
		);
		setActiveIndex(selectedIndex !== -1 ? selectedIndex : 0);
	}, [open, listOptions, value]);

	useEffect(() => {
		const activeOption = optionRefs.current[activeIndex];
		activeOption?.scrollIntoView({ block: "nearest" });
	}, [activeIndex]);

	const closeAndRestoreFocus = () => {
		setOpen(false);
		requestAnimationFrame(() => triggerRef.current?.focus());
	};

	const handleSelect = (nextValue: string) => {
		onValueChange(nextValue);
		closeAndRestoreFocus();
	};

	const selectedLabel = value === "any" ? placeholder : value;
	const searchText = searchLabel ?? placeholder;
	const activeOptionId = `${listId}-option-${activeIndex}`;

	return (
		<div ref={containerRef} className="relative inline-block">
			<button
				type="button"
				ref={triggerRef}
				onClick={() => setOpen((o) => !o)}
				aria-label={ariaLabel ?? selectedLabel}
				aria-haspopup="listbox"
				aria-expanded={open}
				className="inline-flex items-center gap-1 px-2 py-1 text-[var(--color-accent-text)] hover:bg-[var(--color-accent-soft)] cursor-pointer"
			>
				<span className="truncate text-base">{selectedLabel}</span>
				<ChevronDownIcon />
			</button>

			{open && (
				<div
					className="absolute left-0 top-full mt-1.5 z-20 min-w-[260px] bg-[var(--color-panel)] border border-[var(--color-border)] p-2 shadow-lg"
				>
					<div className="flex flex-col gap-2">
						<div className="relative">
							<MagnifyingGlassIcon className="absolute left-2 top-1/2 -translate-y-1/2 text-[var(--color-muted)]" />
							<input
								ref={inputRef}
								type="text"
								value={query}
								onChange={(event) => {
									setQuery(event.target.value);
									setActiveIndex(0);
								}}
								placeholder={`Search ${searchText}`}
								autoComplete="off"
								aria-label={`Search ${searchText}`}
								role="combobox"
								aria-autocomplete="list"
								aria-expanded={open}
								aria-controls={listId}
								aria-activedescendant={activeOptionId}
								className="w-full bg-[var(--color-bg)] border border-[var(--color-border)] pl-7 pr-2 py-1.5 text-sm outline-none focus:border-[var(--color-accent)]"
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
											handleSelect(option.id === "any" ? "any" : option.name);
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

						<div className="overflow-y-auto max-h-80">
							<div
								className="flex flex-col gap-1 py-1 pr-2"
								role="listbox"
								id={listId}
							>
								<OptionRow
									id={`${listId}-option-0`}
									label={placeholder}
									value="any"
									selected={value === "any"}
									active={activeIndex === 0}
									onSelect={handleSelect}
									buttonRef={(node) => {
										optionRefs.current[0] = node;
									}}
								/>
								{filteredOptions.length === 0 ? (
									<p className="text-sm text-[var(--color-muted)] text-center py-2">
										No matches
									</p>
								) : (
									filteredOptions.map((option, index) => (
										<OptionRow
											key={option.id}
											id={`${listId}-option-${index + 1}`}
											label={option.name}
											value={option.name}
											count={option.count}
											selected={normalizeName(value) === normalizeName(option.name)}
											active={activeIndex === index + 1}
											onSelect={handleSelect}
											buttonRef={(node) => {
												optionRefs.current[index + 1] = node;
											}}
										/>
									))
								)}
							</div>
						</div>
					</div>
				</div>
			)}
		</div>
	);
};

const OptionRow = ({
	id,
	label,
	value,
	count,
	selected,
	active,
	onSelect,
	buttonRef,
}: {
	id: string;
	label: string;
	value: string;
	count?: number;
	selected: boolean;
	active: boolean;
	onSelect: (value: string) => void;
	buttonRef: (node: HTMLButtonElement | null) => void;
}) => (
	<button
		type="button"
		id={id}
		ref={buttonRef}
		onClick={() => onSelect(value)}
		role="option"
		aria-selected={selected}
		title={count ? `${label} (${count})` : label}
		className={`flex items-center justify-between w-full text-sm px-2 py-1 text-left text-[var(--color-accent-text)] cursor-pointer ${
			active ? "bg-[var(--color-panel-hover)]" : ""
		} hover:bg-[var(--color-panel-hover)] ${selected ? "font-bold" : ""}`}
	>
		<span className="truncate max-w-60">{label}</span>
		{typeof count === "number" && (
			<span className="shrink-0 text-[var(--color-muted)]">({count})</span>
		)}
	</button>
);

export { Combobox };
