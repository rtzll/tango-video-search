import { ResetIcon } from "@radix-ui/react-icons";

import type { SearchFilters, SearchOptions } from "~/search";

import { AdvancedFilters } from "./advanced-filters";
import { Combobox } from "./combobox";

interface SearchControlsProps {
	filters: SearchFilters;
	onFilterChange: <Key extends keyof SearchFilters>(filter: Key, value: SearchFilters[Key]) => void;
	onReset: () => void;
	options: SearchOptions;
}

function SearchControls({ filters, onFilterChange, onReset, options }: SearchControlsProps) {
	const { dancer1, dancer2, orchestra } = filters;
	const {
		dancer1: dancerOneOptions,
		dancer2: dancerTwoOptions,
		orchestra: orchestraOptions,
	} = options;
	const hasAnyFilters = Object.values(filters).some((value) => value !== null);

	return (
		<>
			<div className="relative flex flex-wrap items-baseline gap-2">
				<span>I want to see</span>
				<Combobox
					value={dancer1}
					onValueChange={(value) => onFilterChange("dancer1", value)}
					options={dancerOneOptions}
					placeholder="any dancer"
					searchLabel="dancer"
					ariaLabel="Select first dancer"
				/>
				<span>and</span>
				<Combobox
					value={dancer2}
					onValueChange={(value) => onFilterChange("dancer2", value)}
					options={dancerTwoOptions}
					placeholder="any dancer"
					searchLabel="dancer"
					ariaLabel="Select second dancer"
				/>
				<span>dance to</span>
				<Combobox
					value={orchestra}
					onValueChange={(value) => onFilterChange("orchestra", value)}
					options={orchestraOptions}
					placeholder="any orchestra"
					searchLabel="orchestra"
					ariaLabel="Select orchestra"
				/>
				{hasAnyFilters && (
					<button
						type="button"
						onClick={onReset}
						aria-label="Reset filters"
						className="bg-accent-soft hover:bg-accent-soft-hover text-accent-text inline-flex h-6 w-6 cursor-pointer items-center justify-center rounded-sm"
					>
						<ResetIcon width={12} height={12} />
					</button>
				)}
			</div>
			<AdvancedFilters
				className="mt-2"
				filters={filters}
				onFilterChange={onFilterChange}
				options={options}
			/>
		</>
	);
}

export { SearchControls };
