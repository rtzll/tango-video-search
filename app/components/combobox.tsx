import { ChevronDownIcon, MagnifyingGlassIcon } from "@radix-ui/react-icons";
import {
	Button,
	Flex,
	Popover,
	ScrollArea,
	Text,
	TextField,
} from "@radix-ui/themes";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { normalizeName } from "~/utils/normalize";

type Option = {
	id: number;
	name: string;
	count: number;
};

interface ComboboxProps {
	/**
	 * Currently selected value.
	 */
	value: string;
	/**
	 * Callback when a new value is selected.
	 */
	onValueChange: (value: string) => void;
	/**
	 * List of selectable options.
	 */
	options: Option[];
	/**
	 * Placeholder text shown when no value is selected.
	 */
	placeholder: string;
	/**
	 * Accessible name for the select trigger (aria-label).
	 * Defaults to placeholder or selected value if not provided.
	 */
	ariaLabel?: string;
}

const Combobox = ({
	value,
	onValueChange,
	options,
	placeholder,
	ariaLabel,
}: ComboboxProps) => {
	const [open, setOpen] = useState(false);
	const [query, setQuery] = useState("");
	const [activeIndex, setActiveIndex] = useState(0);
	const inputRef = useRef<HTMLInputElement>(null);
	const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
	const listId = useId();

	useEffect(() => {
		if (open) {
			setQuery("");
			requestAnimationFrame(() => inputRef.current?.focus());
		}
	}, [open]);

	const filteredOptions = useMemo(() => {
		const normalizedQuery = normalizeName(query.trim());
		if (!normalizedQuery) return options;

		return options.filter((option) =>
			normalizeName(option.name).includes(normalizedQuery),
		);
	}, [options, query]);

	const listOptions = useMemo(
		() => [
			{ id: "any", name: placeholder, count: undefined },
			...filteredOptions,
		],
		[filteredOptions, placeholder],
	);

	useEffect(() => {
		if (!open) return;
		const selectedIndex = listOptions.findIndex((option) =>
			option.id === "any"
				? value === "any"
				: normalizeName(option.name) === normalizeName(value),
		);
		setActiveIndex(selectedIndex >= 0 ? selectedIndex : 0);
	}, [open, listOptions, value]);

	useEffect(() => {
		setActiveIndex(0);
	}, [query]);

	useEffect(() => {
		const activeOption = optionRefs.current[activeIndex];
		activeOption?.scrollIntoView({ block: "nearest" });
	}, [activeIndex]);

	const handleSelect = (nextValue: string) => {
		onValueChange(nextValue);
		setOpen(false);
	};

	const selectedLabel = value === "any" ? placeholder : value;
	const activeOptionId = `${listId}-option-${activeIndex}`;

	return (
		<Popover.Root open={open} onOpenChange={setOpen}>
			<Popover.Trigger>
				<Button
					variant="ghost"
					size="2"
					aria-label={ariaLabel ?? selectedLabel}
				>
					<Text size="3" className="truncate">
						{selectedLabel}
					</Text>
					<ChevronDownIcon />
				</Button>
			</Popover.Trigger>
			<Popover.Content sideOffset={6} className="min-w-[260px]">
				<Flex direction="column" gap="2">
					<TextField.Root
						ref={inputRef}
						value={query}
						onChange={(event) => setQuery(event.target.value)}
						placeholder={`Search ${placeholder.replace("any ", "")}`}
						autoComplete="off"
						aria-label={`Search ${placeholder}`}
						role="combobox"
						aria-autocomplete="list"
						aria-expanded={open}
						aria-controls={listId}
						aria-activedescendant={activeOptionId}
						onKeyDown={(event) => {
							if (!open) return;
							if (event.key === "ArrowDown") {
								event.preventDefault();
								setActiveIndex((index) =>
									index + 1 >= listOptions.length ? 0 : index + 1,
								);
								return;
							}
							if (event.key === "ArrowUp") {
								event.preventDefault();
								setActiveIndex((index) =>
									index - 1 < 0 ? listOptions.length - 1 : index - 1,
								);
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
								setOpen(false);
							}
						}}
					>
						<TextField.Slot>
							<MagnifyingGlassIcon />
						</TextField.Slot>
					</TextField.Root>

					<ScrollArea
						type="auto"
						scrollbars="vertical"
						style={{ maxHeight: 320 }}
					>
						<Flex
							direction="column"
							gap="1"
							py="1"
							role="listbox"
							className="pr-2"
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
								<Text size="2" color="gray" align="center" className="py-2">
									No matches
								</Text>
							) : (
								filteredOptions.map((option, index) => (
									<OptionRow
										key={option.id}
										id={`${listId}-option-${index + 1}`}
										label={option.name}
										value={option.name}
										count={option.count}
										selected={
											normalizeName(value) === normalizeName(option.name)
										}
										active={activeIndex === index + 1}
										onSelect={handleSelect}
										buttonRef={(node) => {
											optionRefs.current[index + 1] = node;
										}}
									/>
								))
							)}
						</Flex>
					</ScrollArea>
				</Flex>
			</Popover.Content>
		</Popover.Root>
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
	<Button
		id={id}
		ref={buttonRef}
		onClick={() => onSelect(value)}
		variant="ghost"
		size="2"
		role="option"
		aria-selected={selected}
		style={{
			justifyContent: "space-between",
			width: "100%",
			backgroundColor: active ? "var(--gray-3)" : undefined,
		}}
		className={selected ? "font-bold" : undefined}
		title={count ? `${label} (${count})` : label}
	>
		<span className="truncate max-w-60 text-left">{label}</span>
		<Flex align="center" gap="1" className="shrink-0">
			{typeof count === "number" && (
				<Text size="2" color="gray">
					({count})
				</Text>
			)}
		</Flex>
	</Button>
);

export { Combobox };
