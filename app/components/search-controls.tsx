import { Cross1Icon, ResetIcon } from "@radix-ui/react-icons";

import type { FilterOption, SearchFilters, SearchOptions } from "~/search";

import { Combobox } from "./combobox";

interface SearchControlsProps {
	filters: SearchFilters;
	onFilterChange: <Key extends keyof SearchFilters>(filter: Key, value: SearchFilters[Key]) => void;
	onReset: () => void;
	options: SearchOptions;
}

function OptionalFilter<Value extends string>({
	label,
	onValueChange,
	options,
	value,
}: {
	label: string;
	onValueChange: (value: Value | null) => void;
	options: readonly FilterOption<Value>[];
	value: Value | null;
}) {
	const article = label === "event" ? "an" : "a";

	if (value === null) {
		return options.length > 0 ? (
			<Combobox
				value={null}
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
	const selectedLabel = options.find((option) => option.value === value)?.label ?? value;

	return (
		<button
			type="button"
			onClick={() => onValueChange(null)}
			className="bg-accent-soft hover:bg-accent-soft-hover text-accent-text inline-flex max-w-full cursor-pointer items-center gap-1 rounded-sm px-2 py-1 text-xs"
		>
			<span className="truncate">
				{label.charAt(0).toUpperCase() + label.slice(1)}: {selectedLabel}
			</span>
			<Cross1Icon className="shrink-0" />
		</button>
	);
}

function SearchControls({ filters, onFilterChange, onReset, options }: SearchControlsProps) {
	const { channel, dancer1, dancer2, event, orchestra, singer, song, year } = filters;
	const {
		channel: channelOptions,
		dancer1: dancerOneOptions,
		dancer2: dancerTwoOptions,
		event: eventOptions,
		orchestra: orchestraOptions,
		singer: singerOptions,
		song: songOptions,
		year: yearOptions,
	} = options;
	const hasAnyFilters = Object.values(filters).some((value) => value !== null);
	const canAddChannel = channelOptions.length > 0;
	const canAddSong = songOptions.length > 0;
	const canAddSinger = singerOptions.length > 0;
	const canAddEvent = eventOptions.length > 0;
	const canAddYear = yearOptions.length > 0;
	const showOptionalFilters =
		canAddChannel ||
		canAddSong ||
		canAddSinger ||
		canAddEvent ||
		canAddYear ||
		song !== null ||
		singer !== null ||
		event !== null ||
		year !== null ||
		channel !== null;

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
						label="song"
						onValueChange={(value) => onFilterChange("song", value)}
						options={songOptions}
						value={song}
					/>
					<OptionalFilter
						label="singer"
						onValueChange={(value) => onFilterChange("singer", value)}
						options={singerOptions}
						value={singer}
					/>
					<OptionalFilter
						label="event"
						onValueChange={(value) => onFilterChange("event", value)}
						options={eventOptions}
						value={event}
					/>
					<OptionalFilter
						label="year"
						onValueChange={(value) => onFilterChange("year", value)}
						options={yearOptions}
						value={year}
					/>
					<OptionalFilter
						label="channel"
						onValueChange={(value) => onFilterChange("channel", value)}
						options={channelOptions}
						value={channel}
					/>
				</div>
			)}
		</>
	);
}

export { SearchControls };
