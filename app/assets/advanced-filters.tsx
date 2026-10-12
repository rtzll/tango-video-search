import { css, type Handle, on, ref } from "remix/component";

import type { SearchFilters, SearchOptions } from "../search.ts";
import { colors } from "../ui/colors.ts";
import { Cross1Icon, MagnifyingGlassIcon } from "../ui/icons.tsx";
import { normalizeName } from "../utils/normalize.ts";
import {
	createPickerPopover,
	popoverOptionRowsStyle,
	popoverPanelChromeStyle,
	popoverSearchStyle,
	POPOVER_VIEWPORT_MARGIN,
} from "./picker-popover.ts";

const advancedFilterDefinitions = [
	{ key: "song", label: "Song" },
	{ key: "singer", label: "Singer" },
	{ key: "event", label: "Event" },
	{ key: "year", label: "Year" },
	{ key: "channel", label: "Channel" },
] as const;

type AdvancedFilterKey = (typeof advancedFilterDefinitions)[number]["key"];

interface AdvancedFiltersProps {
	filters: SearchFilters;
	onSelect: (name: keyof SearchFilters, value: string | null) => void;
	options: SearchOptions;
}

export function AdvancedFilters(handle: Handle<AdvancedFiltersProps>) {
	let query = "";
	let selectedKey: AdvancedFilterKey = "song";
	const picker = createPickerPopover<AdvancedFiltersProps, HTMLSpanElement>(handle, {
		closeOnEscape: true,
		onReset() {
			query = "";
		},
		placement: "viewport",
	});

	function availableFilters() {
		const { filters, options } = handle.props;
		return advancedFilterDefinitions.filter(
			({ key }) => filters[key] === null && options[key].length > 0,
		);
	}

	function openPicker() {
		const available = availableFilters();
		if (!available.some(({ key }) => key === selectedKey)) {
			selectedKey = available[0]?.key ?? "song";
		}
		picker.openPicker();
	}

	return () => {
		const { filters, onSelect, options } = handle.props;
		const appliedFilters = advancedFilterDefinitions.filter(({ key }) => filters[key] !== null);
		const available = availableFilters();
		const selectedAvailableFilter =
			available.find(({ key }) => key === selectedKey) ?? available[0];
		const hasAppliedFilters = appliedFilters.length > 0;

		if (!hasAppliedFilters && available.length === 0) {
			return null;
		}

		const normalizedQuery = normalizeName(query.trim());
		const matchingOptions = selectedAvailableFilter
			? options[selectedAvailableFilter.key]
					.filter(
						(option) =>
							normalizedQuery.length === 0 || normalizeName(option.label).includes(normalizedQuery),
					)
					.slice(0, 100)
			: [];

		return (
			<div
				mix={[
					advancedFiltersStyle,
					ref((node: HTMLDivElement) => {
						picker.setContainer(node);
					}),
				]}
			>
				<span>Only show performances</span>
				{hasAppliedFilters ? <span>where</span> : null}
				{appliedFilters.map(({ key, label }, index) => {
					const value = filters[key];
					if (value === null) {
						return null;
					}
					const selectedLabel =
						options[key].find((option) => option.value === value)?.label ?? value;

					return (
						<span key={key} mix={conditionStyle}>
							{index > 0 ? <span>and</span> : null}
							<button
								aria-label={`Remove ${label.toLowerCase()} condition`}
								mix={[conditionButtonStyle, on("click", () => onSelect(key, null))]}
								type="button"
							>
								<span>
									{label.toLowerCase()} is {selectedLabel}
								</span>
								<Cross1Icon />
							</button>
						</span>
					);
				})}

				{selectedAvailableFilter ? (
					<span mix={advancedPickerStyle}>
						<button
							aria-expanded={picker.open}
							aria-haspopup="dialog"
							aria-label={
								hasAppliedFilters ? "Add another performance detail" : "Choose performance details"
							}
							mix={[
								advancedTriggerStyle,
								on("click", () => (picker.open ? picker.close() : openPicker())),
								ref((node: HTMLButtonElement) => {
									picker.setTrigger(node);
								}),
							]}
							type="button"
						>
							{hasAppliedFilters ? "and…" : "where…"}
						</button>

						{picker.open ? (
							<span
								aria-label="Add a filter condition"
								mix={[
									popoverPanelChromeStyle,
									advancedPanelStyle,
									ref((node: HTMLSpanElement) => {
										picker.setPanel(node);
									}),
								]}
								role="dialog"
								style={
									picker.position
										? { left: picker.position.left, top: picker.position.top }
										: {
												left: POPOVER_VIEWPORT_MARGIN,
												top: POPOVER_VIEWPORT_MARGIN,
												visibility: "hidden",
											}
								}
							>
								<span mix={tabListStyle} role="tablist">
									{available.map((filter) => (
										<button
											aria-selected={filter.key === selectedAvailableFilter.key}
											key={filter.key}
											mix={on("click", () => {
												selectedKey = filter.key;
												query = "";
												void handle.update().then((signal) => {
													if (!signal.aborted) {
														picker.focusInput();
														picker.measurePlacement();
													}
												});
											})}
											role="tab"
											type="button"
										>
											{filter.label}
										</button>
									))}
								</span>

								<label mix={[popoverSearchStyle, pickerSearchStyle]}>
									<MagnifyingGlassIcon />
									<input
										aria-label={`Search ${selectedAvailableFilter.label.toLowerCase()}`}
										autoComplete="off"
										mix={[
											on<HTMLInputElement, "input">("input", (event) => {
												query = event.currentTarget.value;
												void handle.update().then((signal) => {
													if (!signal.aborted) {
														picker.measurePlacement();
													}
												});
											}),
											ref((node: HTMLInputElement) => {
												picker.setInput(node);
											}),
										]}
										placeholder={`Search ${selectedAvailableFilter.label.toLowerCase()}`}
										type="search"
										value={query}
									/>
								</label>

								<span mix={[popoverOptionRowsStyle, pickerOptionsStyle]} role="listbox">
									{matchingOptions.map((option) => (
										<button
											aria-selected="false"
											key={option.value}
											mix={on("click", () => {
												picker.close();
												onSelect(selectedAvailableFilter.key, option.value);
											})}
											role="option"
											title={`${option.label} (${option.count})`}
											type="button"
										>
											<span>{option.label}</span>
											<span>{option.count}</span>
										</button>
									))}
									{matchingOptions.length === 0 ? <span role="status">No matches</span> : null}
								</span>
							</span>
						) : null}
					</span>
				) : null}
			</div>
		);
	};
}

const advancedFiltersStyle = css({
	"@media (min-width: 640px)": { marginTop: 0 },
	alignItems: "center",
	color: colors.muted,
	display: "flex",
	flexWrap: "wrap",
	fontSize: "14px",
	gap: "8px",
	lineHeight: "28px",
	marginTop: "4px",
	position: "relative",
});

const conditionStyle = css({
	alignItems: "center",
	display: "inline-flex",
	gap: "8px",
	maxWidth: "100%",
});

const conditionButtonStyle = css({
	"& > span:first-child": {
		maxWidth: "256px",
		overflow: "hidden",
		textOverflow: "ellipsis",
		whiteSpace: "nowrap",
	},
	"& > svg": { flexShrink: 0 },
	"&:hover": { backgroundColor: colors.accentSoftHover },
	alignItems: "center",
	backgroundColor: colors.accentSoft,
	border: 0,
	borderRadius: "4px",
	color: colors.accentText,
	cursor: "pointer",
	display: "inline-flex",
	fontSize: "12px",
	gap: "4px",
	height: "24px",
	lineHeight: "16px",
	maxWidth: "100%",
	padding: "0 8px",
});

const advancedPickerStyle = css({
	"@media (min-width: 640px)": { position: "relative" },
	display: "inline-flex",
	position: "static",
});

const advancedTriggerStyle = css({
	"&:hover": { backgroundColor: colors.accentSoft },
	alignItems: "center",
	background: "transparent",
	border: `1px dashed ${colors.border}`,
	borderRadius: "4px",
	color: colors.accentText,
	cursor: "pointer",
	display: "inline-flex",
	fontSize: "12px",
	gap: "4px",
	height: "24px",
	lineHeight: "16px",
	padding: "0 8px",
});

const advancedPanelStyle = css({
	display: "flex",
	flexDirection: "column",
	maxHeight: "min(320px, calc(100dvh - 32px))",
	overflow: "hidden",
	position: "fixed",
	width: "min(320px, calc(100vw - 32px))",
	zIndex: 30,
});

const tabListStyle = css({
	"& > button": {
		background: "transparent",
		border: 0,
		borderRadius: "4px",
		color: colors.muted,
		cursor: "pointer",
		flexShrink: 0,
		fontSize: "12px",
		lineHeight: "16px",
		padding: "6px 8px",
	},
	'& > button:not([aria-selected="true"]):hover': {
		backgroundColor: colors.panelHover,
		color: colors.text,
	},
	'& > button[aria-selected="true"]': {
		backgroundColor: colors.accentSoft,
		color: colors.accentText,
		fontWeight: 500,
	},
	display: "flex",
	flexShrink: 0,
	gap: "4px",
	overflowX: "auto",
	padding: "4px 4px 0",
});

const pickerSearchStyle = css({
	"& input": { fontSize: "16px" },
	flexShrink: 0,
});

const pickerOptionsStyle = css({
	"& > button": { gap: "12px" },
	"& > span": {
		color: colors.muted,
		fontSize: "14px",
		lineHeight: "20px",
		padding: "12px 0",
		textAlign: "center",
	},
	display: "flex",
	flexDirection: "column",
	gap: "4px",
	minHeight: 0,
	overflowY: "auto",
	padding: "0 4px 4px",
});
