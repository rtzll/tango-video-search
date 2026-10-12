import {
	clientEntry,
	css,
	type Handle,
	navigate,
	on,
	ref,
	type SerializableProps,
} from "remix/component";

import { routes } from "../routes.ts";
import {
	areFilterValuesEqual,
	type FilterOption,
	type SearchFilters,
	type SearchOptions,
	updateFilterSearchParams,
} from "../search.ts";
import { colors } from "../ui/colors.ts";
import { ChevronDownIcon, MagnifyingGlassIcon, ResetIcon } from "../ui/icons.tsx";
import { normalizeName } from "../utils/normalize.ts";
import { AdvancedFilters } from "./advanced-filters.tsx";
import {
	createPickerPopover,
	popoverOptionRowsStyle,
	popoverPanelChromeStyle,
	popoverSearchStyle,
} from "./picker-popover.ts";

interface SearchControlsProps extends SerializableProps {
	filters: SearchFilters;
	options: SearchOptions;
	searchParams: string;
}

interface PickerProps {
	anyLabel: string;
	ariaLabel: string;
	name: keyof SearchFilters;
	onSelect: (name: keyof SearchFilters, value: string | null) => void;
	options: readonly FilterOption[];
	searchLabel: string;
	value: string | null;
}

export const SearchControlsEntryId = "SearchControls";

export const SearchControls = clientEntry(
	SearchControlsEntryId,
	(handle: Handle<SearchControlsProps>) => () => (
		<>
			<div data-enhanced-search="">
				<EnhancedSearchForm
					filters={handle.props.filters}
					options={handle.props.options}
					searchParams={handle.props.searchParams}
				/>
			</div>
			<noscript>
				<NativeSearchForm filters={handle.props.filters} options={handle.props.options} />
			</noscript>
		</>
	),
);

function NativeSearchForm(handle: Handle<{ filters: SearchFilters; options: SearchOptions }>) {
	return () => {
		const { filters, options } = handle.props;
		const hasFilters = hasActiveFilters(filters);

		return (
			<form action={routes.home.href()} method="get" mix={formStyle}>
				<div mix={primaryFiltersStyle}>
					<span>I want to see</span>
					<NativeFilterSelect
						anyLabel="any dancer"
						label="First dancer"
						name="dancer1"
						options={options.dancer1}
						value={filters.dancer1}
					/>
					<span>and</span>
					<NativeFilterSelect
						anyLabel="any dancer"
						label="Second dancer"
						name="dancer2"
						options={options.dancer2}
						value={filters.dancer2}
					/>
					<span>dance to</span>
					<NativeFilterSelect
						anyLabel="any orchestra"
						label="Orchestra"
						name="orchestra"
						options={options.orchestra}
						value={filters.orchestra}
					/>
				</div>
				<div mix={secondaryFiltersStyle}>
					<NativeFilterSelect
						anyLabel="any song"
						label="Song"
						name="song"
						options={options.song}
						value={filters.song}
					/>
					<NativeFilterSelect
						anyLabel="any singer"
						label="Singer"
						name="singer"
						options={options.singer}
						value={filters.singer}
					/>
					<NativeFilterSelect
						anyLabel="any event"
						label="Event"
						name="event"
						options={options.event}
						value={filters.event}
					/>
					<NativeFilterSelect
						anyLabel="any year"
						label="Year"
						name="year"
						options={options.year}
						value={filters.year}
					/>
					<NativeFilterSelect
						anyLabel="any channel"
						label="Channel"
						name="channel"
						options={options.channel}
						value={filters.channel}
					/>
					<div mix={formActionsStyle}>
						<button type="submit">Apply filters</button>
						{hasFilters ? <a href={routes.home.href()}>Reset</a> : null}
					</div>
				</div>
			</form>
		);
	};
}

function NativeFilterSelect(
	handle: Handle<{
		anyLabel: string;
		label: string;
		name: keyof SearchFilters;
		options: readonly FilterOption[];
		value: string | null;
	}>,
) {
	return () => {
		const { anyLabel, label, name, options, value } = handle.props;
		const selectableOptions = includeCurrentOption(options, value, name);

		return (
			<label mix={nativeFieldStyle}>
				<span mix={visuallyHiddenStyle}>{label}</span>
				<select name={name}>
					<option value="" selected={value === null}>
						{anyLabel}
					</option>
					{selectableOptions.map((option) => (
						<option
							key={`${name}-${option.value}`}
							value={option.value}
							selected={value !== null && areFilterValuesEqual(name, option.value, value)}
						>
							{option.label} ({option.count})
						</option>
					))}
				</select>
			</label>
		);
	};
}

function EnhancedSearchForm(
	handle: Handle<{
		filters: SearchFilters;
		options: SearchOptions;
		searchParams: string;
	}>,
) {
	function visitFilter(name: keyof SearchFilters, value: string | null) {
		const searchParams = updateFilterSearchParams(
			new URLSearchParams(handle.props.searchParams),
			name,
			value,
		);
		const query = searchParams.toString();
		const href = query ? `${routes.home.href()}?${query}` : routes.home.href();
		void navigate(href).catch((error: unknown) => {
			// A newer navigation can cancel this one; keep the newer destination.
			if (error instanceof DOMException && error.name === "AbortError") {
				return;
			}
			globalThis.location.assign(href);
		});
	}

	return () => {
		const { filters, options } = handle.props;
		const hasFilters = hasActiveFilters(filters);

		return (
			<form
				action={routes.home.href()}
				method="get"
				mix={[formStyle, on("submit", (event) => event.preventDefault())]}
			>
				<div mix={primaryFiltersStyle}>
					<span>I want to see</span>
					<FilterPicker
						anyLabel="any dancer"
						ariaLabel="Select first dancer"
						name="dancer1"
						onSelect={visitFilter}
						options={options.dancer1}
						searchLabel="dancer"
						value={filters.dancer1}
					/>
					<span>and</span>
					<FilterPicker
						anyLabel="any dancer"
						ariaLabel="Select second dancer"
						name="dancer2"
						onSelect={visitFilter}
						options={options.dancer2}
						searchLabel="dancer"
						value={filters.dancer2}
					/>
					<span>dance to</span>
					<FilterPicker
						anyLabel="any orchestra"
						ariaLabel="Select orchestra"
						name="orchestra"
						onSelect={visitFilter}
						options={options.orchestra}
						searchLabel="orchestra"
						value={filters.orchestra}
					/>
					{hasFilters ? (
						<a
							aria-label="Reset filters"
							href={routes.home.href()}
							mix={resetButtonStyle}
							title="Reset filters"
						>
							<ResetIcon />
						</a>
					) : null}
				</div>

				<AdvancedFilters filters={filters} onSelect={visitFilter} options={options} />
			</form>
		);
	};
}

function FilterPicker(handle: Handle<PickerProps>) {
	let activeIndex = 0;
	const optionButtons: (HTMLButtonElement | undefined)[] = [];
	let query = "";
	const picker = createPickerPopover<PickerProps, HTMLDivElement>(handle, {
		onReset() {
			query = "";
		},
		placement: "anchored",
	});

	function openPicker() {
		const { value } = handle.props;
		const listOptions = createPickerOptions("");
		const selectedIndex = listOptions.findIndex((option) =>
			option.value === null
				? value === null
				: value !== null && normalizeName(option.value) === normalizeName(value),
		);

		activeIndex = selectedIndex === -1 ? 0 : selectedIndex;
		picker.openPicker();
		handle.queueTask(() => {
			optionButtons[activeIndex]?.scrollIntoView({ block: "nearest" });
		});
	}

	function createPickerOptions(searchQuery: string) {
		const { anyLabel, name, options, value } = handle.props;
		const normalizedQuery = normalizeName(searchQuery.trim());
		const filteredOptions = includeCurrentOption(options, value, name).filter(
			(option) =>
				normalizedQuery.length === 0 || normalizeName(option.label).includes(normalizedQuery),
		);

		return [
			{
				count: undefined,
				id: `${handle.id}-option-any`,
				label: anyLabel,
				value: null,
			},
			...filteredOptions.map((option) => ({
				count: option.count,
				id: `${handle.id}-option-${encodeURIComponent(option.value)}`,
				label: option.label,
				value: option.value,
			})),
		];
	}

	function select(value: string | null) {
		picker.close(true);
		handle.props.onSelect(handle.props.name, value);
	}

	return () => {
		const { anyLabel, ariaLabel, name, searchLabel, value } = handle.props;
		const listOptions = createPickerOptions(query);
		if (activeIndex >= listOptions.length) {
			activeIndex = Math.max(0, listOptions.length - 1);
		}
		const selectedLabel = value === null ? anyLabel : value;
		const listId = `${handle.id}-list`;
		const activeOption = listOptions[activeIndex];

		return (
			<div
				mix={[
					pickerStyle,
					ref((node: HTMLDivElement) => {
						picker.setContainer(node);
					}),
				]}
			>
				<button
					aria-expanded={picker.open}
					aria-haspopup="listbox"
					aria-label={ariaLabel}
					mix={[
						on("click", () => {
							if (picker.open) {
								picker.close();
							} else {
								openPicker();
							}
						}),
						ref((node: HTMLButtonElement) => {
							picker.setTrigger(node);
						}),
					]}
					type="button"
				>
					<span>{selectedLabel}</span>
					{value === null ? <ChevronDownIcon /> : null}
				</button>

				{picker.open ? (
					<div
						data-position={picker.openAbove ? "above" : "below"}
						mix={[
							popoverPanelChromeStyle,
							pickerPanelStyle,
							ref((node: HTMLDivElement) => {
								picker.setPanel(node);
							}),
						]}
					>
						<label mix={popoverSearchStyle}>
							<MagnifyingGlassIcon />
							<span mix={visuallyHiddenStyle}>Search {searchLabel}</span>
							<input
								aria-activedescendant={activeOption?.id}
								aria-autocomplete="list"
								aria-controls={listId}
								aria-expanded="true"
								autoComplete="off"
								id={name}
								mix={[
									on<HTMLInputElement, "input">("input", (event) => {
										query = event.currentTarget.value;
										activeIndex = 0;
										void handle.update().then((signal) => {
											if (!signal.aborted) {
												picker.measurePlacement();
											}
										});
									}),
									on<HTMLInputElement, "keydown">("keydown", (event) => {
										if (event.key === "ArrowDown") {
											event.preventDefault();
											activeIndex =
												listOptions.length === 0 ? 0 : (activeIndex + 1) % listOptions.length;
											void handle.update().then((signal) => {
												if (!signal.aborted) {
													optionButtons[activeIndex]?.scrollIntoView({
														block: "nearest",
													});
												}
											});
										} else if (event.key === "ArrowUp") {
											event.preventDefault();
											activeIndex =
												listOptions.length === 0
													? 0
													: (activeIndex - 1 + listOptions.length) % listOptions.length;
											void handle.update().then((signal) => {
												if (!signal.aborted) {
													optionButtons[activeIndex]?.scrollIntoView({
														block: "nearest",
													});
												}
											});
										} else if (event.key === "Enter") {
											event.preventDefault();
											const option = listOptions[activeIndex];
											if (option) {
												select(option.value);
											}
										} else if (event.key === "Escape") {
											event.preventDefault();
											picker.close(true);
										}
									}),
									ref((node: HTMLInputElement) => {
										picker.setInput(node);
									}),
								]}
								placeholder={`Search ${searchLabel}`}
								role="combobox"
								type="text"
								value={query}
							/>
						</label>

						<div id={listId} mix={[popoverOptionRowsStyle, pickerOptionsStyle]} role="listbox">
							{listOptions.map((option, index) => [
								<button
									aria-selected={
										option.value === null
											? value === null
											: value !== null && normalizeName(option.value) === normalizeName(value)
									}
									id={option.id}
									key={option.id}
									mix={[
										on("click", () => select(option.value)),
										ref((node: HTMLButtonElement) => {
											optionButtons[index] = node;
										}),
									]}
									role="option"
									tabIndex={-1}
									title={
										option.count === undefined ? option.label : `${option.label} · ${option.count}`
									}
									type="button"
									data-active={index === activeIndex ? "true" : undefined}
								>
									<span>{option.label}</span>
									{option.count === undefined ? null : <span>{option.count}</span>}
								</button>,
								option.value === null && listOptions.length > 1 ? (
									<div key={`${option.id}-separator`} mix={pickerSeparatorStyle} role="separator" />
								) : null,
							])}
							{listOptions.every((option) => option.value === null) ? (
								<p role="status">No matches</p>
							) : null}
						</div>
					</div>
				) : null}
			</div>
		);
	};
}

function includeCurrentOption(
	options: readonly FilterOption[],
	value: string | null,
	name: keyof SearchFilters,
) {
	if (value === null || options.some((option) => areFilterValuesEqual(name, option.value, value))) {
		return options;
	}
	return [{ count: 0, label: value, value }, ...options];
}

function hasActiveFilters(filters: SearchFilters) {
	return Object.values(filters).some((value) => value !== null);
}

const formStyle = css({
	display: "grid",
	gap: "8px",
});

const primaryFiltersStyle = css({
	alignItems: "baseline",
	display: "flex",
	flexWrap: "wrap",
	gap: "8px",
	position: "relative",
});

const secondaryFiltersStyle = css({
	alignItems: "center",
	display: "flex",
	flexWrap: "wrap",
	gap: "8px",
	position: "relative",
});

const visuallyHiddenStyle = css({
	clipPath: "inset(50%)",
	height: "1px",
	margin: "-1px",
	overflow: "hidden",
	padding: 0,
	position: "absolute",
	whiteSpace: "nowrap",
	width: "1px",
});

const nativeFieldStyle = css({
	"& select": {
		backgroundColor: colors.background,
		border: `1px solid ${colors.borderStrong}`,
		borderRadius: "5px",
		color: colors.text,
		minHeight: "40px",
		minWidth: 0,
		padding: "7px 32px 7px 10px",
		width: "100%",
	},
	"& select:focus-visible": {
		outline: `2px solid ${colors.accent}`,
		outlineOffset: "2px",
	},
	"@media (max-width: 560px)": {
		flex: "1 1 100%",
		width: "100%",
	},
	display: "inline-flex",
	flex: "0 1 220px",
	minWidth: 0,
});

const formActionsStyle = css({
	"& a": {
		border: `1px solid ${colors.borderStrong}`,
		color: colors.accentText,
	},
	"& a:hover": { backgroundColor: colors.accentSoft },
	"& button": {
		backgroundColor: colors.accent,
		border: `1px solid ${colors.accent}`,
		color: colors.background,
		cursor: "pointer",
		fontWeight: 600,
	},
	"& button, & a": {
		alignItems: "center",
		borderRadius: "5px",
		display: "inline-flex",
		fontSize: "14px",
		justifyContent: "center",
		minHeight: "38px",
		padding: "7px 14px",
		textDecoration: "none",
	},
	"& button:hover": { backgroundColor: colors.accentHover },
	alignItems: "center",
	display: "flex",
	gap: "12px",
});

const pickerStyle = css({
	"& > button": {
		alignItems: "center",
		background: "none",
		border: 0,
		color: colors.accentText,
		cursor: "pointer",
		display: "inline-flex",
		fontSize: "16px",
		gap: "4px",
		lineHeight: "24px",
		maxWidth: "100%",
		padding: 0,
		position: "relative",
		textDecoration: "none",
	},
	"& > button > span:first-child": {
		overflow: "hidden",
		textDecoration: `underline dotted ${colors.accentUnderline}`,
		textOverflow: "ellipsis",
		textUnderlineOffset: "4px",
		whiteSpace: "nowrap",
	},
	"& > button > svg": {
		flexShrink: 0,
		opacity: 0.5,
	},
	"& > button::after": {
		content: '""',
		inset: "-8px 0",
		position: "absolute",
	},
	"& > button:focus-visible": { outline: "none" },
	"& > button:hover > span:first-child, & > button:focus-visible > span:first-child": {
		textDecorationColor: colors.accent,
		textDecorationStyle: "solid",
	},
	"@media (min-width: 640px)": {
		position: "relative",
	},
	display: "inline-block",
	maxWidth: "100%",
	position: "static",
});

const pickerPanelStyle = css({
	'&[data-position="above"]': {
		bottom: "calc(100% + 6px)",
		top: "auto",
	},
	'&[data-position="below"]': {
		bottom: "auto",
		top: "calc(100% + 6px)",
	},
	"@media (min-width: 640px)": {
		left: 0,
		minWidth: "280px",
		right: "auto",
	},
	display: "flex",
	flexDirection: "column",
	gap: "8px",
	left: 0,
	minWidth: 0,
	position: "absolute",
	right: 0,
	zIndex: 20,
});

const pickerOptionsStyle = css({
	'& > button[aria-selected="true"]': {
		backgroundColor: colors.accentSoft,
		color: colors.accentText,
		fontWeight: 500,
	},
	'& > button[data-active="true"]': {
		backgroundColor: colors.panelHover,
	},
	"& > p": {
		color: colors.muted,
		fontSize: "14px",
		lineHeight: "20px",
		margin: 0,
		padding: "12px 0",
		textAlign: "center",
	},
	display: "flex",
	flexDirection: "column",
	gap: "4px",
	maxHeight: "320px",
	overflowY: "auto",
	padding: "0 4px 4px",
});

const pickerSeparatorStyle = css({
	borderTop: `1px solid ${colors.border}`,
	flexShrink: 0,
	margin: "4px 8px",
});

const resetButtonStyle = css({
	"&:hover": { backgroundColor: colors.accentSoftHover },
	alignItems: "center",
	backgroundColor: colors.accentSoft,
	borderRadius: "4px",
	color: colors.accentText,
	display: "inline-flex",
	height: "24px",
	justifyContent: "center",
	textDecoration: "none",
	width: "24px",
});
