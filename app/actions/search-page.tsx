import { css, type Handle, type RemixNode } from "remix/component";

import { SearchControls } from "../assets/search-controls.tsx";
import { routes } from "../routes.ts";
import {
	getPageHref as createPageHref,
	isSameResultFilterValue,
	type ResultFilter,
	type SearchFilters,
	type SearchOptions,
	type SearchVideo,
	toggleResultFilterSearchParams,
} from "../search.ts";
import { colors } from "../ui/colors.ts";
import {
	ArrowTopRightIcon,
	ChevronLeftIcon,
	ChevronRightIcon,
	GitHubLogoIcon,
} from "../ui/icons.tsx";

interface SearchPageProps {
	filters: SearchFilters;
	formattedLastUpdate: string;
	initialVideos: SearchVideo[];
	options: SearchOptions;
	page: number;
	pageSize: number;
	searchParams: string;
	totalPages: number;
	totalVideos: number;
}

export function SearchPage(handle: Handle<SearchPageProps>) {
	return () => {
		const {
			filters,
			formattedLastUpdate,
			initialVideos,
			options,
			page,
			pageSize,
			searchParams: serializedSearchParams,
			totalPages,
			totalVideos,
		} = handle.props;
		const searchParams = new URLSearchParams(serializedSearchParams);
		const startIndex = totalVideos === 0 ? 0 : (page - 1) * pageSize + 1;
		const endIndex = Math.min(page * pageSize, totalVideos);
		const resultText =
			totalVideos === 0
				? "No performances match these filters."
				: `Showing ${startIndex}–${endIndex} of ${totalVideos.toLocaleString("en-US")} performances`;

		return (
			<main mix={pageStyle}>
				<section aria-labelledby="search-heading" mix={searchSectionStyle}>
					<h1 id="search-heading" mix={visuallyHiddenStyle}>
						Tango Video Search
					</h1>

					<SearchControls
						filters={filters}
						options={options}
						searchParams={serializedSearchParams}
					/>

					<ResultsNavigation
						announce
						ariaLabel="Results pages, top"
						page={page}
						resultText={resultText}
						searchParams={searchParams}
						totalPages={totalPages}
					/>
				</section>

				<section aria-label="Search results" mix={resultsStyle}>
					<div mix={resultGridStyle}>
						{initialVideos.map((video) => (
							<VideoCard
								key={video.id}
								activeFilters={filters}
								searchParams={searchParams}
								video={video}
							/>
						))}
					</div>

					<ResultsNavigation
						ariaLabel="Results pages, bottom"
						page={page}
						resultText={resultText}
						searchParams={searchParams}
						totalPages={totalPages}
					/>
				</section>

				<footer mix={footerStyle}>
					<span>Data refreshed: {formattedLastUpdate}</span>
					<a
						href="https://github.com/rtzll/tango-video-search"
						target="_blank"
						rel="noopener noreferrer"
					>
						Source code
						<GitHubLogoIcon />
					</a>
				</footer>
			</main>
		);
	};
}

function ResultsNavigation(
	handle: Handle<{
		announce?: boolean;
		ariaLabel: string;
		page: number;
		resultText: string;
		searchParams: URLSearchParams;
		totalPages: number;
	}>,
) {
	return () => {
		const { announce, ariaLabel, page, resultText, searchParams, totalPages } = handle.props;

		return (
			<div mix={announce ? [navigationRowStyle, topNavigationStyle] : navigationRowStyle}>
				<span aria-live={announce ? "polite" : undefined}>{resultText}</span>
				<nav aria-label={ariaLabel} mix={paginationStyle}>
					{page <= 1 ? (
						<span aria-disabled="true">
							<ChevronLeftIcon />
							Previous
						</span>
					) : (
						<a href={pageHref(searchParams, page - 1)}>
							<ChevronLeftIcon />
							Previous
						</a>
					)}
					<small>
						Page {page} of {totalPages}
					</small>
					{page >= totalPages ? (
						<span aria-disabled="true">
							Next
							<ChevronRightIcon />
						</span>
					) : (
						<a href={pageHref(searchParams, page + 1)}>
							Next
							<ChevronRightIcon />
						</a>
					)}
				</nav>
			</div>
		);
	};
}

function VideoCard(
	handle: Handle<{
		activeFilters: SearchFilters;
		searchParams: URLSearchParams;
		video: SearchVideo;
	}>,
) {
	return () => {
		const { activeFilters, searchParams, video } = handle.props;
		const thumbnailUrl = `https://i.ytimg.com/vi/${video.id}/hqdefault.jpg`;
		const videoLabel = `Watch ${video.dancers.join(" and ")} dance to ${video.songTitle} by ${video.orchestra} on YouTube`;
		const eventMetadata = getEventMetadata(video.event, video.year);

		return (
			<article mix={cardStyle}>
				<a
					href={`https://youtube.com/watch?v=${video.id}`}
					target="_blank"
					rel="noopener noreferrer"
					aria-label={videoLabel}
					mix={thumbnailLinkStyle}
				>
					<img src={thumbnailUrl} alt="" loading="lazy" />
					<span aria-hidden="true" mix={thumbnailTintStyle} />
					<span aria-hidden="true" mix={externalBadgeStyle}>
						<ArrowTopRightIcon />
					</span>
				</a>

				<div mix={cardBodyStyle}>
					<h2>
						{video.dancers.map((dancer, index) => (
							<span key={`${video.id}-${dancer}`}>
								<FilterLink
									active={isActiveFilter(activeFilters, "dancer", dancer)}
									href={resultFilterHref(searchParams, "dancer", dancer)}
								>
									{dancer}
								</FilterLink>
								{index < video.dancers.length - 1 ? (
									<span mix={dancerConjunctionStyle}>{" and "}</span>
								) : (
									""
								)}
							</span>
						))}
					</h2>

					<p>
						dancing to{" "}
						<FilterLink
							active={isActiveFilter(activeFilters, "song", video.songTitle)}
							href={resultFilterHref(searchParams, "song", video.songTitle)}
						>
							{video.songTitle}
						</FilterLink>{" "}
						by{" "}
						<FilterLink
							active={isActiveFilter(activeFilters, "orchestra", video.orchestra)}
							href={resultFilterHref(searchParams, "orchestra", video.orchestra)}
						>
							{video.orchestra}
						</FilterLink>
					</p>

					{video.singers.length > 0 ? (
						<p>
							with vocals by{" "}
							{video.singers.map((singer, index) => (
								<span key={`${video.id}-${singer}`}>
									<FilterLink
										active={isActiveFilter(activeFilters, "singer", singer)}
										href={resultFilterHref(searchParams, "singer", singer)}
									>
										{singer}
									</FilterLink>
									{index < video.singers.length - 1 ? ", " : ""}
								</span>
							))}
						</p>
					) : null}

					<div mix={cardSpacerStyle} />
					<div mix={cardMetadataStyle}>
						<span mix={channelMetadataStyle}>
							<span>via</span>
							<span mix={channelTitleStyle}>
								<FilterLink
									active={isActiveFilter(activeFilters, "channel", video.channelId)}
									href={resultFilterHref(searchParams, "channel", video.channelId)}
								>
									{video.channelTitle}
								</FilterLink>
							</span>
						</span>
						{eventMetadata ? (
							<span mix={eventMetadataStyle} title={eventMetadata.label}>
								{eventMetadata.kind === "event" ? (
									<span>
										<FilterLink
											active={isActiveFilter(activeFilters, "event", eventMetadata.event.value)}
											href={resultFilterHref(searchParams, "event", eventMetadata.event.value)}
										>
											{eventMetadata.event.label}
										</FilterLink>
									</span>
								) : null}
								{eventMetadata.kind === "event" && eventMetadata.year ? (
									<span aria-hidden="true">·</span>
								) : null}
								{eventMetadata.year ? (
									<FilterLink
										active={isActiveFilter(activeFilters, "year", eventMetadata.year)}
										href={resultFilterHref(searchParams, "year", eventMetadata.year)}
									>
										{eventMetadata.year}
									</FilterLink>
								) : null}
							</span>
						) : null}
					</div>
				</div>
			</article>
		);
	};
}

function FilterLink(handle: Handle<{ active: boolean; children?: RemixNode; href: string }>) {
	return () => {
		const { active, children, href } = handle.props;
		return (
			<a href={href} aria-current={active ? "page" : undefined} mix={filterLinkStyle}>
				<span>{children}</span>
			</a>
		);
	};
}

function resultFilterHref(searchParams: URLSearchParams, type: ResultFilter, value: string) {
	return searchHref(toggleResultFilterSearchParams(searchParams, type, value));
}

function searchHref(searchParams: URLSearchParams) {
	const query = searchParams.toString();
	return query ? `${routes.home.href()}?${query}` : routes.home.href();
}

function pageHref(searchParams: URLSearchParams, page: number) {
	const relativeHref = createPageHref(searchParams, page);
	return relativeHref === "." ? routes.home.href() : `${routes.home.href()}${relativeHref}`;
}

function isActiveFilter(filters: SearchFilters, type: ResultFilter, value: string) {
	if (type === "dancer") {
		return [filters.dancer1, filters.dancer2].some((dancer) =>
			isSameResultFilterValue(type, dancer, value),
		);
	}

	return isSameResultFilterValue(type, filters[type], value);
}

type EventMetadata =
	| {
			kind: "event";
			event: { label: string; value: string };
			label: string;
			year: string | null;
	  }
	| { kind: "year"; label: string; year: string };

export function getEventMetadata(event: string | null, year: number | null): EventMetadata | null {
	const cleanEvent = event?.trim() || null;
	const cleanYear = year ? String(year) : null;
	if (!cleanEvent && !cleanYear) {
		return null;
	}
	const displayEvent =
		cleanEvent && cleanYear
			? cleanEvent.replace(new RegExp(`(?:\\s*[·–—-]?\\s*)${cleanYear}\\s*$`), "").trim() || null
			: cleanEvent;
	if (!displayEvent || !cleanEvent) {
		return cleanYear ? { kind: "year", label: cleanYear, year: cleanYear } : null;
	}
	return {
		event: { label: displayEvent, value: cleanEvent },
		kind: "event",
		label: [displayEvent, cleanYear].filter(Boolean).join(" · "),
		year: cleanYear,
	};
}

const pageStyle = css({
	display: "flex",
	flexDirection: "column",
	gap: "12px",
	margin: "0 auto",
	minHeight: "100dvh",
	padding: "24px",
	width: "min(100%, 1400px)",
});

const searchSectionStyle = css({
	display: "grid",
	gap: "8px",
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

const resultsStyle = css({
	display: "grid",
	gap: "12px",
});

const resultGridStyle = css({
	"@media (max-width: 1023px)": {
		gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
	},
	"@media (max-width: 639px)": {
		gridTemplateColumns: "1fr",
	},
	display: "grid",
	gap: "16px",
	gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
});

const navigationRowStyle = css({
	alignItems: "center",
	color: colors.muted,
	display: "flex",
	flexWrap: "wrap",
	fontSize: "14px",
	gap: "12px",
	justifyContent: "space-between",
	lineHeight: "20px",
});

const topNavigationStyle = css({
	"@media (min-width: 640px)": { marginTop: 0 },
	marginTop: "8px",
});

const paginationStyle = css({
	'& > span[aria-disabled="true"]': { cursor: "not-allowed", opacity: 0.5 },
	"& a, & > span": {
		alignItems: "center",
		border: `1px solid ${colors.border}`,
		borderRadius: "4px",
		color: colors.accentText,
		display: "inline-flex",
		fontSize: "12px",
		gap: "4px",
		lineHeight: "16px",
		padding: "4px 8px",
		textDecoration: "none",
	},
	"& a:hover": { backgroundColor: colors.accentSoft },
	"& small": { fontSize: "12px", lineHeight: "16px" },
	alignItems: "center",
	display: "flex",
	gap: "8px",
});

const cardStyle = css({
	backgroundColor: colors.panel,
	border: `1px solid ${colors.border}`,
	borderRadius: "6px",
	display: "flex",
	flexDirection: "column",
	overflow: "hidden",
});

const thumbnailLinkStyle = css({
	"& img": {
		display: "block",
		height: "100%",
		objectFit: "cover",
		width: "100%",
	},
	"&:hover > span:first-of-type, &:focus-visible > span:first-of-type": {
		opacity: 0,
	},
	"&:hover > span:last-child, &:focus-visible > span:last-child": {
		backgroundColor: colors.accentSoft,
	},
	aspectRatio: "16 / 9",
	backgroundColor: colors.panelHover,
	display: "block",
	overflow: "hidden",
	position: "relative",
});

const thumbnailTintStyle = css({
	backgroundColor: colors.thumbnailTint,
	inset: 0,
	mixBlendMode: "color",
	pointerEvents: "none",
	position: "absolute",
	transition: "opacity 200ms ease-out",
});

const externalBadgeStyle = css({
	alignItems: "center",
	backgroundColor: colors.background,
	border: `1px solid ${colors.border}`,
	borderRadius: "4px",
	color: colors.accentText,
	display: "inline-flex",
	height: "28px",
	justifyContent: "center",
	position: "absolute",
	right: "8px",
	top: "8px",
	width: "28px",
});

const cardBodyStyle = css({
	"& h2": {
		display: "flex",
		flexWrap: "wrap",
		fontSize: "18px",
		fontWeight: 400,
		lineHeight: 1.375,
		margin: 0,
	},
	"& p": {
		color: colors.muted,
		fontSize: "14px",
		lineHeight: "20px",
		margin: "4px 0 0",
	},
	display: "flex",
	flex: 1,
	flexDirection: "column",
	padding: "16px",
});

const dancerConjunctionStyle = css({
	marginRight: "4px",
});

const filterLinkStyle = css({
	"& > span": { position: "relative", zIndex: 1 },
	'&:not([aria-current="page"])::before': {
		backgroundColor: colors.panelActive,
		borderRadius: "4px",
		content: '""',
		inset: "0 -2px",
		pointerEvents: "none",
		position: "absolute",
		transition: "background-color 150ms ease",
		zIndex: 0,
	},
	'&:not([aria-current="page"]):hover::before': {
		backgroundColor: colors.accentSoft,
	},
	'&[aria-current="page"]': { color: colors.accentText },
	color: colors.text,
	cursor: "pointer",
	display: "inline-block",
	fontWeight: 400,
	lineHeight: 1.25,
	position: "relative",
	textDecoration: "none",
});

const cardSpacerStyle = css({
	flex: 1,
	minHeight: "20px",
});

const cardMetadataStyle = css({
	alignItems: "end",
	color: colors.muted,
	display: "grid",
	fontSize: "12px",
	gap: "12px",
	gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)",
	lineHeight: "16px",
});

const channelMetadataStyle = css({
	"& > span:first-child": { flexShrink: 0 },
	alignItems: "baseline",
	display: "flex",
	gap: "4px",
	minWidth: 0,
});

const channelTitleStyle = css({
	"& > a": { display: "block", maxWidth: "100%" },
	"& > a > span": {
		display: "block",
		overflow: "hidden",
		textOverflow: "ellipsis",
		whiteSpace: "nowrap",
	},
	minWidth: 0,
});

const eventMetadataStyle = css({
	"& > a, & > span[aria-hidden]": { flexShrink: 0 },
	"& > span:first-child": { minWidth: 0 },
	"& > span > a": { display: "block", maxWidth: "100%" },
	"& > span > a > span": {
		display: "block",
		overflow: "hidden",
		textOverflow: "ellipsis",
		whiteSpace: "nowrap",
	},
	alignItems: "baseline",
	display: "flex",
	gap: "4px",
	justifyContent: "end",
	minWidth: 0,
});

const footerStyle = css({
	"& a": {
		alignItems: "center",
		color: "inherit",
		display: "inline-flex",
		gap: "4px",
		textDecoration: "none",
	},
	"& a:hover": { color: colors.accentText, textDecoration: "underline" },
	alignItems: "baseline",
	color: colors.muted,
	display: "flex",
	flexWrap: "wrap",
	fontSize: "12px",
	gap: "12px",
	justifyContent: "space-between",
	lineHeight: "16px",
	marginTop: "auto",
	paddingTop: "28px",
});
