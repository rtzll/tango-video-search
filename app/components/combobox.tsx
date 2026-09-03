import { ChevronDownIcon, MagnifyingGlassIcon } from "@radix-ui/react-icons";
import * as stylex from "@stylexjs/stylex";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";

import type { FilterOption } from "~/search";
import { normalizeName } from "~/utils/normalize";

import { pickerStyles } from "../styles/picker";
import { colors } from "../styles/tokens.stylex";

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

	return (
		<div ref={containerRef} {...stylex.props(styles.container)}>
			<button
				type="button"
				ref={triggerRef}
				onClick={() => setOpen((currentOpen) => !currentOpen)}
				aria-label={ariaLabel ?? selectedLabel}
				aria-haspopup="listbox"
				aria-expanded={open}
				{...stylex.props(styles.trigger)}
			>
				<span {...stylex.props(styles.label)}>{selectedLabel}</span>
				{showCaret && value === null && (
					<ChevronDownIcon {...stylex.props(styles.caret)} width={12} height={12} />
				)}
			</button>

			{open && (
				<div
					ref={panelRef}
					{...stylex.props(
						pickerStyles.panel,
						styles.panel,
						openAbove ? styles.panelAbove : styles.panelBelow,
					)}
				>
					<div {...stylex.props(styles.panelContent)}>
						<div {...stylex.props(pickerStyles.search)}>
							<MagnifyingGlassIcon {...stylex.props(pickerStyles.searchIcon)} />
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
								{...stylex.props(pickerStyles.input)}
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

						<div {...stylex.props(styles.scrollArea)}>
							<div {...stylex.props(styles.options)} role="listbox" id={listId}>
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
									<div {...stylex.props(styles.separator)} />
								)}
								{filteredOptions.length === 0 ? (
									<p {...stylex.props(pickerStyles.empty)}>No matches</p>
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
		title={props.kind === "option" ? `${props.label} · ${props.count}` : props.label}
		{...stylex.props(
			pickerStyles.option,
			props.active && pickerStyles.activeOption,
			props.selected && pickerStyles.selectedOption,
		)}
	>
		<span {...stylex.props(pickerStyles.optionLabel)}>{props.label}</span>
		{props.kind === "option" && <span {...stylex.props(pickerStyles.count)}>{props.count}</span>}
	</button>
);

export { Combobox };

const styles = stylex.create({
	caret: { opacity: 0.5 },
	container: {
		display: "inline-block",
		position: { "@media (min-width: 40rem)": "relative", default: "static" },
	},
	label: {
		fontSize: "1rem",
		lineHeight: "1.5rem",
		overflow: "hidden",
		textOverflow: "ellipsis",
		whiteSpace: "nowrap",
	},
	options: { display: "flex", flexDirection: "column", gap: "0.25rem" },
	panel: {
		left: 0,
		minWidth: { "@media (min-width: 40rem)": "17.5rem", default: 0 },
		position: "absolute",
		right: { "@media (min-width: 40rem)": "auto", default: 0 },
		zIndex: 20,
	},
	panelAbove: { bottom: "100%", marginBottom: "0.375rem" },
	panelBelow: { marginTop: "0.375rem", top: "100%" },
	panelContent: { display: "flex", flexDirection: "column", gap: "0.5rem" },
	scrollArea: {
		maxHeight: "20rem",
		overflowY: "auto",
		paddingBottom: "0.25rem",
		paddingInline: "0.25rem",
	},
	separator: {
		borderColor: colors.border,
		borderTopStyle: "solid",
		borderTopWidth: 1,
		marginBlock: "0.25rem",
		marginInline: "0.5rem",
	},
	trigger: {
		"::after": {
			bottom: "-0.5rem",
			content: "''",
			insetInline: 0,
			position: "absolute",
			top: "-0.5rem",
		},
		alignItems: "center",
		color: colors.accentText,
		cursor: "pointer",
		display: "inline-flex",
		gap: "0.25rem",
		outlineStyle: { ":focus-visible": "none", default: null },
		padding: 0,
		position: "relative",
		textDecorationColor: {
			":focus-visible": colors.accent,
			"@media (hover: hover)": { ":hover": colors.accent },
			default: `color-mix(in oklab, ${colors.accent} 60%, transparent)`,
		},
		textDecorationLine: "underline",
		textDecorationStyle: {
			":focus-visible": "solid",
			"@media (hover: hover)": { ":hover": "solid" },
			default: "dotted",
		},
		textUnderlineOffset: 4,
	},
});
