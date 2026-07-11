import { ChevronLeftIcon, ChevronRightIcon } from "@radix-ui/react-icons";
import { Link as RouterLink } from "react-router";

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
		<div className="flex flex-wrap items-center justify-between gap-3">
			<span className="text-muted text-sm" aria-live={announce ? "polite" : undefined}>
				{resultText}
			</span>
			<nav className="flex items-center gap-2" aria-label={ariaLabel}>
				{page <= 1 ? (
					<button
						type="button"
						disabled
						className="border-border text-accent-text inline-flex cursor-not-allowed items-center gap-1 rounded-sm border px-2 py-1 text-xs opacity-50"
					>
						<ChevronLeftIcon width={14} height={14} />
						Previous
					</button>
				) : (
					<RouterLink
						to={getPageHref(page - 1)}
						className="border-border text-accent-text hover:bg-accent-soft inline-flex items-center gap-1 rounded-sm border px-2 py-1 text-xs"
					>
						<ChevronLeftIcon width={14} height={14} />
						Previous
					</RouterLink>
				)}
				<span className="text-muted text-xs">
					Page {page} of {totalPages}
				</span>
				{page >= totalPages ? (
					<button
						type="button"
						disabled
						className="border-border text-accent-text inline-flex cursor-not-allowed items-center gap-1 rounded-sm border px-2 py-1 text-xs opacity-50"
					>
						Next
						<ChevronRightIcon width={14} height={14} />
					</button>
				) : (
					<RouterLink
						to={getPageHref(page + 1)}
						className="border-border text-accent-text hover:bg-accent-soft inline-flex items-center gap-1 rounded-sm border px-2 py-1 text-xs"
					>
						Next
						<ChevronRightIcon width={14} height={14} />
					</RouterLink>
				)}
			</nav>
		</div>
	);
}

export { ResultsNavigation };
