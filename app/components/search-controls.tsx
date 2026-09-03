import { ResetIcon } from "@radix-ui/react-icons";
import * as stylex from "@stylexjs/stylex";

import type { SearchFilters, SearchOptions } from "~/search";

import { colors } from "../styles/tokens.stylex";
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
			<div {...stylex.props(styles.controls)}>
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
						{...stylex.props(styles.reset)}
					>
						<ResetIcon width={12} height={12} />
					</button>
				)}
			</div>
			<AdvancedFilters
				xstyle={styles.advancedFilters}
				filters={filters}
				onFilterChange={onFilterChange}
				options={options}
			/>
		</>
	);
}

export { SearchControls };

const styles = stylex.create({
	advancedFilters: { marginTop: { "@media (min-width: 40rem)": "0.5rem", default: "0.75rem" } },
	controls: {
		alignItems: "baseline",
		display: "flex",
		flexWrap: "wrap",
		gap: "0.5rem",
		position: "relative",
	},
	reset: {
		alignItems: "center",
		backgroundColor: {
			"@media (hover: hover)": { ":hover": colors.accentSoftHover },
			default: colors.accentSoft,
		},
		borderRadius: "0.25rem",
		color: colors.accentText,
		cursor: "pointer",
		display: "inline-flex",
		height: "1.5rem",
		justifyContent: "center",
		width: "1.5rem",
	},
});
