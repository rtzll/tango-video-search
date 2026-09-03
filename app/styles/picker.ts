import * as stylex from "@stylexjs/stylex";

import { colors } from "./tokens.stylex";

export const pickerStyles = stylex.create({
	activeOption: {
		backgroundColor: colors.panelHover,
	},
	count: {
		color: colors.muted,
		flexShrink: 0,
		fontSize: "0.75rem",
		fontVariantNumeric: "tabular-nums",
		lineHeight: "1rem",
	},
	empty: {
		color: colors.muted,
		fontSize: "0.875rem",
		lineHeight: "1.25rem",
		paddingBlock: "0.75rem",
		textAlign: "center",
	},
	input: {
		"::placeholder": { color: colors.muted },
		backgroundColor: "transparent",
		flex: 1,
		fontSize: "1rem",
		lineHeight: "1.5rem",
		minWidth: 0,
		outlineStyle: "none",
		paddingBlock: "0.25rem",
	},
	option: {
		alignItems: "center",
		backgroundColor: {
			"@media (hover: hover)": { ":hover": colors.panelHover },
			default: "transparent",
		},
		borderRadius: "0.25rem",
		color: colors.text,
		cursor: "pointer",
		display: "flex",
		fontSize: "0.875rem",
		justifyContent: "space-between",
		lineHeight: "1.25rem",
		minHeight: "2.5rem",
		paddingBlock: "0.5rem",
		paddingInline: "0.75rem",
		textAlign: "left",
		width: "100%",
	},
	optionLabel: {
		maxWidth: "15rem",
		overflow: "hidden",
		textOverflow: "ellipsis",
		whiteSpace: "nowrap",
	},
	panel: {
		backgroundColor: colors.panel,
		borderColor: colors.border,
		borderRadius: "0.375rem",
		borderStyle: "solid",
		borderWidth: 1,
		boxShadow: "0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)",
		padding: "0.25rem",
	},
	search: {
		alignItems: "center",
		display: "flex",
		gap: "0.5rem",
		padding: "0.5rem",
		position: "relative",
	},
	searchIcon: { color: colors.muted, flexShrink: 0 },
	selectedOption: {
		backgroundColor: {
			"@media (hover: hover)": { ":hover": colors.panelHover },
			default: colors.accentSoft,
		},
		color: colors.accentText,
		fontWeight: 500,
	},
});
