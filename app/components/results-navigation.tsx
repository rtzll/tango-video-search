import { ChevronLeftIcon, ChevronRightIcon } from "@radix-ui/react-icons";
import * as stylex from "@stylexjs/stylex";
import { Link as RouterLink } from "react-router";

import { colors } from "../styles/tokens.stylex";

interface ResultsNavigationProps {
	announce?: boolean;
	ariaLabel: string;
	getPageHref: (nextPage: number) => string;
	page: number;
	resultText: string;
	totalPages: number;
}

function ResultsNavigation({
	announce,
	ariaLabel,
	getPageHref,
	page,
	resultText,
	totalPages,
}: ResultsNavigationProps) {
	return (
		<div {...stylex.props(styles.container)}>
			<span {...stylex.props(styles.resultText)} aria-live={announce ? "polite" : undefined}>
				{resultText}
			</span>
			<nav {...stylex.props(styles.navigation)} aria-label={ariaLabel}>
				{page <= 1 ? (
					<button type="button" disabled {...stylex.props(styles.pageControl, styles.disabled)}>
						<ChevronLeftIcon width={14} height={14} />
						Previous
					</button>
				) : (
					<RouterLink to={getPageHref(page - 1)} {...stylex.props(styles.pageControl, styles.link)}>
						<ChevronLeftIcon width={14} height={14} />
						Previous
					</RouterLink>
				)}
				<span {...stylex.props(styles.pageNumber)}>
					Page {page} of {totalPages}
				</span>
				{page >= totalPages ? (
					<button type="button" disabled {...stylex.props(styles.pageControl, styles.disabled)}>
						Next
						<ChevronRightIcon width={14} height={14} />
					</button>
				) : (
					<RouterLink to={getPageHref(page + 1)} {...stylex.props(styles.pageControl, styles.link)}>
						Next
						<ChevronRightIcon width={14} height={14} />
					</RouterLink>
				)}
			</nav>
		</div>
	);
}

export { ResultsNavigation };

const styles = stylex.create({
	container: {
		alignItems: "center",
		display: "flex",
		flexWrap: "wrap",
		gap: "0.75rem",
		justifyContent: "space-between",
	},
	disabled: { cursor: "not-allowed", opacity: 0.5 },
	link: {
		backgroundColor: {
			"@media (hover: hover)": { ":hover": colors.accentSoft },
			default: "transparent",
		},
	},
	navigation: { alignItems: "center", display: "flex", gap: "0.5rem" },
	pageControl: {
		alignItems: "center",
		borderColor: colors.border,
		borderRadius: "0.25rem",
		borderStyle: "solid",
		borderWidth: 1,
		color: colors.accentText,
		display: "inline-flex",
		fontSize: "0.75rem",
		gap: "0.25rem",
		lineHeight: "1rem",
		paddingBlock: "0.25rem",
		paddingInline: "0.5rem",
	},
	pageNumber: { color: colors.muted, fontSize: "0.75rem", lineHeight: "1rem" },
	resultText: { color: colors.muted, fontSize: "0.875rem", lineHeight: "1.25rem" },
});
