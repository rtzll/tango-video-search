import { ArrowTopRightIcon } from "@radix-ui/react-icons";
import * as stylex from "@stylexjs/stylex";

import {
	isSameResultFilterValue,
	type ResultFilter,
	type SearchFilters,
	type SearchVideo,
} from "~/search";

import { colors } from "../styles/tokens.stylex";

interface VideoCardProps {
	video: SearchVideo;
	onFilterClick: (type: ResultFilter, value: string) => void;
	filters: SearchFilters;
}

function VideoCard({ video, onFilterClick, filters }: VideoCardProps) {
	const thumbnailUrl = `https://i.ytimg.com/vi/${video.id}/hqdefault.jpg`;
	const videoLinkLabel = `Watch ${video.dancers.join(" and ")} dance to ${video.songTitle} by ${video.orchestra} on YouTube`;
	const eventMetadata = getEventMetadata(video.event, video.year);
	const eventYear = eventMetadata?.year ?? null;

	const isActive = (type: ResultFilter, value: string) => {
		if (type === "dancer") {
			return [filters.dancer1, filters.dancer2].some((dancer) =>
				isSameResultFilterValue(type, dancer, value),
			);
		}
		return isSameResultFilterValue(type, filters[type], value);
	};

	return (
		<article {...stylex.props(styles.card)}>
			<a
				href={`https://youtube.com/watch?v=${video.id}`}
				target="_blank"
				rel="noopener noreferrer"
				aria-label={videoLinkLabel}
				{...stylex.props(styles.thumbnailLink, stylex.defaultMarker())}
			>
				<img src={thumbnailUrl} alt="" loading="lazy" {...stylex.props(styles.thumbnail)} />
				<span {...stylex.props(styles.tint)} />
				<span {...stylex.props(styles.watchIcon)}>
					<ArrowTopRightIcon aria-hidden />
				</span>
			</a>

			<div {...stylex.props(styles.content)}>
				<h2 {...stylex.props(styles.dancers)}>
					{video.dancers.map((dancer, index) => (
						<span key={`${video.id}-${dancer}`}>
							<FilterButton
								onClick={() => onFilterClick("dancer", dancer)}
								active={isActive("dancer", dancer)}
							>
								{dancer}
							</FilterButton>
							{index < video.dancers.length - 1 ? (
								<span {...stylex.props(styles.conjunction)}>{" and "}</span>
							) : (
								""
							)}
						</span>
					))}
				</h2>

				<p {...stylex.props(styles.description)}>
					dancing to{" "}
					<FilterButton
						onClick={() => onFilterClick("song", video.songTitle)}
						active={isActive("song", video.songTitle)}
					>
						{video.songTitle}
					</FilterButton>{" "}
					by{" "}
					<FilterButton
						onClick={() => onFilterClick("orchestra", video.orchestra)}
						active={isActive("orchestra", video.orchestra)}
					>
						{video.orchestra}
					</FilterButton>
				</p>

				{video.singers.length > 0 && (
					<p {...stylex.props(styles.description)}>
						with vocals by{" "}
						{video.singers.map((singer, index) => (
							<span key={`${video.id}-${singer}`}>
								<FilterButton
									onClick={() => onFilterClick("singer", singer)}
									active={isActive("singer", singer)}
								>
									{singer}
								</FilterButton>
								{index < video.singers.length - 1 ? ", " : ""}
							</span>
						))}
					</p>
				)}
				<div {...stylex.props(styles.spacer)} />

				<div {...stylex.props(styles.metadata)}>
					<div {...stylex.props(styles.channel)}>
						<span {...stylex.props(styles.noShrink)}>via</span>
						<span {...stylex.props(styles.metadataValue)}>
							<FilterButton
								xstyle={styles.metadataButton}
								active={isActive("channel", video.channelId)}
								onClick={() => onFilterClick("channel", video.channelId)}
							>
								<span {...stylex.props(styles.truncatedLabel)}>{video.channelTitle}</span>
							</FilterButton>
						</span>
					</div>
					{eventMetadata && (
						<span {...stylex.props(styles.event)} title={eventMetadata.label}>
							{eventMetadata.kind === "event" && (
								<span {...stylex.props(styles.metadataValue)}>
									<FilterButton
										xstyle={styles.metadataButton}
										active={isActive("event", eventMetadata.event.value)}
										onClick={() => onFilterClick("event", eventMetadata.event.value)}
									>
										<span {...stylex.props(styles.truncatedLabel)}>
											{eventMetadata.event.label}
										</span>
									</FilterButton>
								</span>
							)}
							{eventMetadata.kind === "event" && eventYear && (
								<span {...stylex.props(styles.noShrink)}>·</span>
							)}
							{eventYear && (
								<span {...stylex.props(styles.noShrink)}>
									<FilterButton
										active={isActive("year", eventYear)}
										onClick={() => onFilterClick("year", eventYear)}
									>
										{eventYear}
									</FilterButton>
								</span>
							)}
						</span>
					)}
				</div>
			</div>
		</article>
	);
}

type EventMetadata =
	| {
			kind: "event";
			event: { label: string; value: string };
			label: string;
			year: string | null;
	  }
	| { kind: "year"; label: string; year: string };

function getEventMetadata(event: string | null, year: number | null): EventMetadata | null {
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

function FilterButton({
	xstyle,
	onClick,
	active,
	children,
}: {
	onClick: () => void;
	active: boolean;
	children: React.ReactNode;
	xstyle?: stylex.StyleXStyles;
}) {
	return (
		<button
			type="button"
			onClick={onClick}
			{...stylex.props(
				styles.filter,
				active && styles.activeFilter,
				xstyle,
				stylex.defaultMarker(),
			)}
		>
			{!active && <span aria-hidden {...stylex.props(styles.filterBackground)} />}
			<span {...stylex.props(styles.filterLabel)}>{children}</span>
		</button>
	);
}

export { VideoCard };

const styles = stylex.create({
	activeFilter: { color: colors.accentText },
	card: {
		backgroundColor: colors.panel,
		borderColor: colors.border,
		borderRadius: "0.375rem",
		borderStyle: "solid",
		borderWidth: 1,
		display: "flex",
		flexDirection: "column",
		overflow: "hidden",
	},
	channel: { alignItems: "baseline", display: "inline-flex", gap: "0.25rem", minWidth: 0 },
	conjunction: { marginRight: "0.25rem" },
	content: { display: "flex", flex: 1, flexDirection: "column", padding: "1rem" },
	dancers: {
		display: "flex",
		flexWrap: "wrap",
		fontSize: "1.125rem",
		fontWeight: 400,
		lineHeight: 1.375,
	},
	description: {
		color: colors.muted,
		fontSize: "0.875rem",
		lineHeight: "1.25rem",
		marginTop: "0.25rem",
	},
	event: {
		alignItems: "baseline",
		display: "flex",
		gap: "0.25rem",
		justifyContent: "flex-end",
		minWidth: 0,
	},
	filter: {
		color: colors.text,
		cursor: "pointer",
		fontWeight: 400,
		lineHeight: 1.25,
		position: "relative",
	},
	filterBackground: {
		backgroundColor: {
			"@media (hover: hover)": { [stylex.when.ancestor(":hover")]: colors.accentSoft },
			default: colors.panelActive,
		},
		borderRadius: "0.25rem",
		bottom: 0,
		left: "-0.125rem",
		pointerEvents: "none",
		position: "absolute",
		right: "-0.125rem",
		top: 0,
		transitionDuration: "150ms",
		transitionProperty:
			"color, background-color, border-color, text-decoration-color, fill, stroke",
		transitionTimingFunction: "cubic-bezier(0.4, 0, 0.2, 1)",
		zIndex: 0,
	},
	filterLabel: { position: "relative", zIndex: 10 },
	metadata: {
		alignItems: "end",
		color: colors.muted,
		display: "grid",
		fontSize: "0.75rem",
		gap: "0.75rem",
		gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
		lineHeight: "1rem",
	},
	metadataButton: { display: "block", maxWidth: "100%" },
	metadataValue: { minWidth: 0 },
	noShrink: { flexShrink: 0 },
	spacer: { flex: 1, minHeight: "1.25rem" },
	thumbnail: { height: "100%", objectFit: "cover", width: "100%" },
	thumbnailLink: {
		aspectRatio: "16 / 9",
		backgroundColor: colors.panelHover,
		overflow: "hidden",
		position: "relative",
	},
	tint: {
		backgroundColor: `color-mix(in oklab, ${colors.accent} 45%, transparent)`,
		inset: 0,
		mixBlendMode: "color",
		opacity: {
			"@media (hover: hover)": { [stylex.when.ancestor(":hover")]: 0 },
			default: 1,
			[stylex.when.ancestor(":focus-visible")]: 0,
		},
		pointerEvents: "none",
		position: "absolute",
		transitionDuration: "200ms",
		transitionProperty: "opacity",
		transitionTimingFunction: "cubic-bezier(0.4, 0, 0.2, 1)",
	},
	truncatedLabel: {
		display: "block",
		overflow: "hidden",
		textOverflow: "ellipsis",
		whiteSpace: "nowrap",
	},
	watchIcon: {
		alignItems: "center",
		backgroundColor: {
			"@media (hover: hover)": { [stylex.when.ancestor(":hover")]: colors.accentSoft },
			default: colors.background,
			[stylex.when.ancestor(":focus-visible")]: colors.accentSoft,
		},
		borderColor: colors.border,
		borderRadius: "0.25rem",
		borderStyle: "solid",
		borderWidth: 1,
		color: colors.accentText,
		display: "inline-flex",
		height: "1.75rem",
		justifyContent: "center",
		pointerEvents: "none",
		position: "absolute",
		right: "0.5rem",
		top: "0.5rem",
		transitionDuration: "150ms",
		transitionProperty:
			"color, background-color, border-color, text-decoration-color, fill, stroke",
		transitionTimingFunction: "cubic-bezier(0.4, 0, 0.2, 1)",
		width: "1.75rem",
		zIndex: 10,
	},
});
