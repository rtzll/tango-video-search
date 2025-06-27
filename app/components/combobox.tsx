import { ChevronDownIcon, MagnifyingGlassIcon } from "@radix-ui/react-icons";
import { Box, Flex, Text, TextField } from "@radix-ui/themes";
import { useState, useRef, useEffect } from "react";

export type ComboboxOption = {
	id: number;
	name: string;
	count: number;
};

export interface ComboboxProps {
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
	options: ComboboxOption[];
	/**
	 * Placeholder text shown when no value is selected.
	 */
	placeholder: string;
	/**
	 * Accessible name for the combobox (aria-label).
	 */
	ariaLabel?: string;
}

export const Combobox = ({
	value,
	onValueChange,
	options,
	placeholder,
	ariaLabel,
}: ComboboxProps) => {
	const [isOpen, setIsOpen] = useState(false);
	const [searchTerm, setSearchTerm] = useState("");
	const [focusedIndex, setFocusedIndex] = useState(-1);
	const containerRef = useRef<HTMLDivElement>(null);
	const searchInputRef = useRef<HTMLInputElement>(null);
	const listRef = useRef<HTMLUListElement>(null);

	const filteredOptions = options.filter((option) =>
		option.name.toLowerCase().includes(searchTerm.toLowerCase())
	);

	const shouldShowAnyOption = !searchTerm || placeholder.toLowerCase().includes(searchTerm.toLowerCase());
	const displayValue = value === "any" ? placeholder : value;

	useEffect(() => {
		const handleClickOutside = (event: MouseEvent) => {
			if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
				setIsOpen(false);
				setSearchTerm("");
				setFocusedIndex(-1);
			}
		};

		if (isOpen) {
			document.addEventListener("mousedown", handleClickOutside);
			return () => document.removeEventListener("mousedown", handleClickOutside);
		}
	}, [isOpen]);

	useEffect(() => {
		if (isOpen && searchInputRef.current) {
			searchInputRef.current.focus();
		}
	}, [isOpen]);

	useEffect(() => {
		if (isOpen && focusedIndex >= 0 && listRef.current) {
			const focusedElement = listRef.current.children[focusedIndex + 1] as HTMLElement;
			if (focusedElement) {
				focusedElement.scrollIntoView({ block: "nearest" });
			}
		}
	}, [focusedIndex, isOpen]);

	const handleTriggerClick = () => {
		setIsOpen(!isOpen);
		setSearchTerm("");
		setFocusedIndex(-1);
	};

	const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
		const totalOptions = (shouldShowAnyOption ? 1 : 0) + filteredOptions.length;
		
		switch (e.key) {
			case "ArrowDown":
				e.preventDefault();
				setFocusedIndex((prev) => {
					if (prev === -1 && totalOptions > 0) return 0;
					return prev < totalOptions - 1 ? prev + 1 : prev;
				});
				break;
			case "ArrowUp":
				e.preventDefault();
				setFocusedIndex((prev) => (prev > 0 ? prev - 1 : -1));
				break;
			case "Enter":
				e.preventDefault();
				if (shouldShowAnyOption && focusedIndex === 0) {
					handleSelectOption("any");
				} else if (focusedIndex >= 0) {
					const adjustedIndex = shouldShowAnyOption ? focusedIndex - 1 : focusedIndex;
					if (adjustedIndex >= 0 && adjustedIndex < filteredOptions.length) {
						handleSelectOption(filteredOptions[adjustedIndex].name);
					}
				}
				break;
			case "Escape":
				setIsOpen(false);
				setSearchTerm("");
				setFocusedIndex(-1);
				break;
		}
	};

	const handleSelectOption = (optionValue: string) => {
		onValueChange(optionValue);
		setIsOpen(false);
		setSearchTerm("");
		setFocusedIndex(-1);
	};

	const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		setSearchTerm(e.target.value);
		setFocusedIndex(-1);
	};

	return (
		<Box ref={containerRef} position="relative" style={{ display: "inline-block" }}>
			{/* Trigger button that looks like the original select */}
			<button
				type="button"
				onClick={handleTriggerClick}
				aria-label={ariaLabel}
				aria-expanded={isOpen}
				aria-haspopup="listbox"
				style={{
					display: "flex",
					alignItems: "center",
					justifyContent: "space-between",
					padding: "var(--space-2)",
					backgroundColor: "transparent",
					border: "none",
					borderRadius: "var(--radius-2)",
					cursor: "pointer",
					fontSize: "var(--font-size-3)",
					color: value === "any" ? "var(--gray-11)" : "var(--accent-11)",
					minHeight: "32px",
					gap: "var(--space-1)",
				}}
			>
				<Text size="3" style={{ color: value === "any" ? "var(--gray-11)" : "var(--accent-11)" }}>{displayValue}</Text>
				<ChevronDownIcon 
					width="16" 
					height="16" 
					style={{ 
						transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
						transition: "transform 0.2s ease"
					}} 
				/>
			</button>

			{isOpen && (
				<Box
					position="absolute"
					top="100%"
					left="0"
					mt="1"
					style={{
						backgroundColor: "var(--color-panel-solid)",
						border: "1px solid var(--gray-6)",
						borderRadius: "var(--radius-3)",
						boxShadow: "var(--shadow-4)",
						maxHeight: "200px",
						overflowY: "auto",
						zIndex: 50,
						minWidth: "200px",
						width: "max-content",
					}}
				>
					<Box p="1">
						{/* Search input inside dropdown */}
						<TextField.Root
							ref={searchInputRef}
							value={searchTerm}
							onChange={handleSearchChange}
							onKeyDown={handleSearchKeyDown}
							placeholder="Search..."
							size="2"
							variant="surface"
							style={{ 
								marginBottom: "var(--space-1)",
								...{"--focus-color": "var(--accent-8)", "--border-color": "var(--accent-7)"} as any
							}}
						>
							<TextField.Slot>
								<MagnifyingGlassIcon height="14" width="14" />
							</TextField.Slot>
						</TextField.Root>

						<ul
							ref={listRef}
							role="listbox"
							style={{
								listStyle: "none",
								margin: 0,
								padding: 0,
							}}
						>
							{shouldShowAnyOption && (
								<li
									role="option"
									aria-selected={value === "any"}
									onClick={() => handleSelectOption("any")}
									onMouseEnter={() => setFocusedIndex(0)}
									style={{
										padding: "var(--space-2)",
										cursor: "pointer",
										borderRadius: "var(--radius-2)",
										backgroundColor: focusedIndex === 0
											? "var(--gray-3)" 
											: value === "any" 
											? "var(--accent-9)" 
											: "transparent",
										color: value === "any" ? "var(--accent-9-contrast)" : "inherit",
									}}
								>
									<Text size="2">{placeholder}</Text>
								</li>
							)}
							{filteredOptions.map((option, index) => (
								<li
									key={option.id}
									role="option"
									aria-selected={value === option.name}
									onClick={() => handleSelectOption(option.name)}
									onMouseEnter={() => setFocusedIndex(shouldShowAnyOption ? index + 1 : index)}
									style={{
										padding: "var(--space-2)",
										cursor: "pointer",
										borderRadius: "var(--radius-2)",
										backgroundColor: focusedIndex === (shouldShowAnyOption ? index + 1 : index)
											? "var(--gray-3)" 
											: value === option.name 
											? "var(--accent-9)" 
											: "transparent",
										color: value === option.name ? "var(--accent-9-contrast)" : "inherit",
									}}
								>
									<Flex align="center" justify="between">
										<Text 
											size="2" 
											style={{ 
												overflow: "hidden", 
												textOverflow: "ellipsis", 
												whiteSpace: "nowrap",
												maxWidth: "200px" 
											}}
											title={`${option.name} (${option.count})`}
										>
											{option.name}
										</Text>
										<Text size="1" color="gray">
											({option.count})
										</Text>
									</Flex>
								</li>
							))}
							{filteredOptions.length === 0 && searchTerm && (
								<li
									style={{
										padding: "var(--space-2)",
										color: "var(--gray-9)",
									}}
								>
									<Text size="2">No results found</Text>
								</li>
							)}
						</ul>
					</Box>
				</Box>
			)}
		</Box>
	);
};