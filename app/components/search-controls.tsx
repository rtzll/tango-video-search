import { Cross1Icon, ResetIcon } from "@radix-ui/react-icons";

import type { SearchFilters, SearchOption, SearchOptions } from "~/search";
import { ANY_FILTER_VALUE } from "~/utils/filters";

import { Combobox } from "./combobox";

interface SearchControlsProps {
	filters: SearchFilters;
	onFilterChange: (filter: keyof SearchFilters, value: string) => void;
	onReset: () => void;
	options: SearchOptions;
}

function OptionalFilter({
	available,
	label,
	onValueChange,
	options,
	value,
}: {
	available: boolean;
	label: string;
	onValueChange: (value: string) => void;
	options: SearchOption[];
	value: string;
}) {
	const article = label === "event" ? "an" : "a";

	if (value === ANY_FILTER_VALUE) {
		return available ? (
			<Combobox
				value={ANY_FILTER_VALUE}
				onValueChange={onValueChange}
				options={options}
				placeholder={`+ ${label}`}
				searchLabel={label}
				ariaLabel={`Add ${article} ${label} filter`}
				includeEmptyOption={false}
				showCaret={false}
			/>
		) : null;
	}

	return (
		<button
			type="button"
			onClick={() => onValueChange(ANY_FILTER_VALUE)}
			className="bg-accent-soft hover:bg-accent-soft-hover text-accent-text inline-flex max-w-full cursor-pointer items-center gap-1 rounded-sm px-2 py-1 text-xs"
		>
			<span className="truncate">
				{label.charAt(0).toUpperCase() + label.slice(1)}: {value}
			</span>
			<Cross1Icon className="shrink-0" />
		</button>
	);
}

function SearchControls({ filters, onFilterChange, onReset, options }: SearchControlsProps) {
	const { dancer1, dancer2, event, orchestra, singer, song, year } = filters;
	const {
		dancer1: dancerOneOptions,
		dancer2: dancerTwoOptions,
		event: eventOptions,
		orchestra: orchestraOptions,
		singer: singerOptions,
		song: songOptions,
		year: yearOptions,
	} = options;
	const hasAnyFilters = Object.values(filters).some((value) => value !== ANY_FILTER_VALUE);
	const canAddSong = songOptions.length > 0;
	const canAddSinger = singerOptions.length > 0;
	const canAddEvent = eventOptions.length > 0;
	const canAddYear = yearOptions.length > 0;
	const showOptionalFilters =
		canAddSong ||
		canAddSinger ||
		canAddEvent ||
		canAddYear ||
		song !== ANY_FILTER_VALUE ||
		singer !== ANY_FILTER_VALUE ||
		event !== ANY_FILTER_VALUE ||
		year !== ANY_FILTER_VALUE;

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
			{showOptionalFilters && (
				<div className="relative mt-2 flex flex-wrap items-center gap-2">
					<OptionalFilter
						available={canAddSong}
						label="song"
						onValueChange={(value) => onFilterChange("song", value)}
						options={songOptions}
						value={song}
					/>
					<OptionalFilter
						available={canAddSinger}
						label="singer"
						onValueChange={(value) => onFilterChange("singer", value)}
						options={singerOptions}
						value={singer}
					/>
					<OptionalFilter
						available={canAddEvent}
						label="event"
						onValueChange={(value) => onFilterChange("event", value)}
						options={eventOptions}
						value={event}
					/>
					<OptionalFilter
						available={canAddYear}
						label="year"
						onValueChange={(value) => onFilterChange("year", value)}
						options={yearOptions}
						value={year}
					/>
				</div>
			)}
		</>
	);
}

export { SearchControls };
