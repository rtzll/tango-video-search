import {
	CheckIcon,
	ChevronDownIcon,
	MagnifyingGlassIcon,
} from "@radix-ui/react-icons";
import {
	Button,
	Flex,
	Popover,
	ScrollArea,
	Text,
	TextField,
} from "@radix-ui/themes";
import { useEffect, useMemo, useRef, useState } from "react";

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
	const inputRef = useRef<HTMLInputElement>(null);

	useEffect(() => {
		if (open) {
			setQuery("");
			requestAnimationFrame(() => inputRef.current?.focus());
		}
	}, [open]);

	const filteredOptions = useMemo(() => {
		const normalizedQuery = normalizeText(query.trim());
		if (!normalizedQuery) return options;

		return options.filter((option) =>
			normalizeText(option.name).includes(normalizedQuery),
		);
	}, [options, query]);

	const handleSelect = (nextValue: string) => {
		onValueChange(nextValue);
		setOpen(false);
	};

	const selectedLabel = value === "any" ? placeholder : value;

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
						<Flex direction="column" gap="1" py="1" role="listbox">
							<OptionRow
								label={placeholder}
								value="any"
								selected={value === "any"}
								onSelect={handleSelect}
							/>
							{filteredOptions.length === 0 ? (
								<Text size="2" color="gray" align="center" className="py-2">
									No matches
								</Text>
							) : (
								filteredOptions.map((option) => (
									<OptionRow
										key={option.id}
										label={option.name}
										value={option.name}
										count={option.count}
										selected={value === option.name}
										onSelect={handleSelect}
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
	label,
	value,
	count,
	selected,
	onSelect,
}: {
	label: string;
	value: string;
	count?: number;
	selected: boolean;
	onSelect: (value: string) => void;
}) => (
	<Button
		onClick={() => onSelect(value)}
		variant={selected ? "soft" : "ghost"}
		size="2"
		role="option"
		aria-selected={selected}
		style={{ justifyContent: "space-between", width: "100%" }}
		title={count ? `${label} (${count})` : label}
	>
		<span className="truncate max-w-60 text-left">{label}</span>
		<Flex align="center" gap="1" className="shrink-0">
			{typeof count === "number" && (
				<Text size="2" color="gray">
					({count})
				</Text>
			)}
			{selected && <CheckIcon />}
		</Flex>
	</Button>
);

const normalizeText = (text: string) =>
	text
		.toLocaleLowerCase()
		.normalize("NFD")
		.replace(/\p{Diacritic}/gu, "");

export { Combobox };
