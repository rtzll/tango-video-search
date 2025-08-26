import { Select, Text } from "@radix-ui/themes";

type Option = {
	id: number;
	name: string;
	count: number;
};

interface OptionsSelectProps {
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

const OptionsSelect = ({
	value,
	onValueChange,
	options,
	placeholder,
	ariaLabel,
}: OptionsSelectProps) => {
	return (
		<Select.Root value={value} onValueChange={onValueChange} size="2">
			<Select.Trigger
				placeholder={placeholder}
				variant="ghost"
				aria-label={ariaLabel ?? (value === "any" ? placeholder : value)}
			>
				<Text size="3">{value === "any" ? placeholder : value}</Text>
			</Select.Trigger>
			<Select.Content>
				<Select.Group>
					<Select.Item value="any">{placeholder}</Select.Item>
					{options.map((option) => (
						<Select.Item key={option.id} value={option.name}>
							<div
								className="flex items-center"
								title={`${option.name} (${option.count})`}
							>
								<span className="truncate max-w-[240px]">{option.name}</span>
								<span className="ml-1">({option.count})</span>
							</div>
						</Select.Item>
					))}
				</Select.Group>
			</Select.Content>
		</Select.Root>
	);
};

export { OptionsSelect };
