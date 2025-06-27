"use client";

import * as React from "react";
import { Popover, TextField, ScrollArea, Text, Button } from "@radix-ui/themes";
import { ChevronDownIcon } from "@radix-ui/react-icons";
import type { Option } from "./options-select";

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
	options: Option[];
	/**
	 * Placeholder text shown when no value is selected.
	 */
	placeholder?: string;
	/**
	 * Accessible name for the input (aria-label).
	 */
	ariaLabel?: string;
}

export const Combobox = ({
	value,
	onValueChange,
	options,
	placeholder = "",
	ariaLabel,
}: ComboboxProps) => {
	const [open, setOpen] = React.useState(false);
	const [query, setQuery] = React.useState("");
	const [highlightedIndex, setHighlightedIndex] = React.useState(0);

	const filtered = React.useMemo(
		() =>
			query === ""
				? options
				: options.filter((option) =>
						option.name.toLowerCase().includes(query.toLowerCase()),
					),
		[options, query],
	);

	// include a synthetic "any" option at the top to reset to 'any'
	const displayOptions = React.useMemo(
		() => [{ id: -1, name: "any", count: 0 }, ...filtered],
		[filtered],
	);

	// reset highlighted index when options change
	React.useEffect(() => {
		setHighlightedIndex(0);
	}, [displayOptions]);

	const selectOption = (option: Option) => {
		onValueChange(option.name);
		setQuery("");
		setOpen(false);
	};

	const inputRef = React.useRef<HTMLInputElement>(null);

	return (
		<Popover.Root open={open} onOpenChange={setOpen}>
			{/* @ts-ignore asChild prop enables using the Button as the popover trigger */}
			<Popover.Trigger asChild>
				<Button
					variant="ghost"
					size="2"
					className="justify-between"
					aria-label={ariaLabel ?? (value === "any" ? placeholder : value)}
				>
					{value === "any" ? placeholder : value}
					<ChevronDownIcon />
				</Button>
			</Popover.Trigger>

			<Popover.Content>
				<div className="flex flex-col gap-2 p-2">
					<TextField.Root
						ref={inputRef}
						size="2"
						placeholder="Type to search..."
						value={query}
						onChange={(e) => setQuery(e.currentTarget.value)}
						autoFocus
						onKeyDown={(e) => {
							if (!filtered.length) return;
							if (e.key === "ArrowDown") {
								e.preventDefault();
								setHighlightedIndex((i) => (i + 1) % filtered.length);
							} else if (e.key === "ArrowUp") {
								e.preventDefault();
								setHighlightedIndex((i) =>
									i > 0 ? i - 1 : filtered.length - 1,
								);
							} else if (e.key === "Enter") {
								e.preventDefault();
								selectOption(filtered[highlightedIndex]);
							}
						}}
					/>
					<ScrollArea style={{ maxHeight: 200 }}>
						{displayOptions.length > 0 ? (
							displayOptions.map((option, index) => {
								const isAny = option.name === "any";
								return (
									<div
										key={option.id.toString()}
										className={`flex items-center justify-between px-2 py-1 rounded cursor-pointer ${
											index === highlightedIndex
												? "bg-gray-100 dark:bg-gray-700"
												: ""
										}`}
										onMouseEnter={() => setHighlightedIndex(index)}
										onClick={() =>
											isAny
												? selectOption({ id: -1, name: "any", count: 0 })
												: selectOption(option)
										}
									>
										<Text size="2" className="truncate">
											{isAny ? placeholder : option.name}
										</Text>
										{!isAny && <Text size="1">({option.count})</Text>}
									</div>
								);
							})
						) : (
							<Text size="2" className="p-2 text-center">
								No results found.
							</Text>
						)}
					</ScrollArea>
				</div>
			</Popover.Content>
		</Popover.Root>
	);
};
