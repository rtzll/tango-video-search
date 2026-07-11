import { ArrowTopRightIcon } from "@radix-ui/react-icons";

import type { ResultFilter, SearchVideo } from "~/search";
import { ANY_FILTER_VALUE } from "~/utils/filters";
import { normalizeName } from "~/utils/normalize";

interface VideoCardProps {
	video: SearchVideo;
	onFilterClick: (type: ResultFilter, value: string) => void;
	activeFilters: {
		dancers: string[];
		event: string;
		orchestra: string;
		singer: string;
		song: string;
		year: string;
	};
}

function VideoCard({ video, onFilterClick, activeFilters }: VideoCardProps) {
	const thumbnailUrl = `https://i.ytimg.com/vi/${video.id}/hqdefault.jpg`;
	const videoLinkLabel = `Watch ${video.dancers.join(" and ")} dance to ${video.songTitle} by ${video.orchestra} on YouTube`;
	const eventMetadata = getEventMetadata(video.event, video.year);

	const isActive = (type: ResultFilter, value: string) => {
		const normalizedValue = normalizeName(value);
		if (type === "dancer") {
			return activeFilters.dancers.some(
				(dancer) => dancer !== ANY_FILTER_VALUE && normalizeName(dancer) === normalizedValue,
			);
		}
		const currentValue = activeFilters[type];
		return currentValue !== ANY_FILTER_VALUE && normalizeName(currentValue) === normalizedValue;
	};

	return (
		<article className="border-border bg-panel flex flex-col overflow-hidden rounded-md border">
			<a
				href={`https://youtube.com/watch?v=${video.id}`}
				target="_blank"
				rel="noopener noreferrer"
				aria-label={videoLinkLabel}
				className="bg-panel-hover group relative aspect-video overflow-hidden"
			>
				<img src={thumbnailUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
				<span className="bg-accent/45 pointer-events-none absolute inset-0 mix-blend-color transition-opacity duration-200 group-hover:opacity-0 group-focus-visible:opacity-0" />
				<span className="border-border bg-bg text-accent-text group-hover:bg-accent-soft group-focus-visible:bg-accent-soft pointer-events-none absolute top-2 right-2 z-10 inline-flex h-7 w-7 items-center justify-center rounded-sm border transition-colors">
					<ArrowTopRightIcon aria-hidden />
				</span>
			</a>

			<div className="flex flex-1 flex-col p-4">
				<h2 className="flex flex-wrap text-lg leading-snug font-normal">
					{video.dancers.map((dancer, index) => (
						<span key={`${video.id}-${dancer}`}>
							<FilterButton
								onClick={() => onFilterClick("dancer", dancer)}
								active={isActive("dancer", dancer)}
							>
								{dancer}
							</FilterButton>
							{index < video.dancers.length - 1 ? <span className="mr-1">{" and "}</span> : ""}
						</span>
					))}
				</h2>

				<p className="text-muted mt-1 text-sm">
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
					<p className="text-muted mt-1 text-sm">
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
				<div className="min-h-5 flex-1" />

				<div className="text-muted flex items-end justify-between gap-3 text-xs">
					<a
						href={`https://youtube.com/channel/${video.channelId}`}
						target="_blank"
						rel="noopener noreferrer"
						className="hover:text-accent-text inline-flex min-w-0 items-end gap-1 hover:underline"
					>
						<span className="truncate">via {video.channelTitle}</span>
						<ArrowTopRightIcon className="shrink-0" />
					</a>
					{eventMetadata && (
						<span
							className="flex min-w-0 max-w-3/5 shrink-0 items-baseline justify-end gap-1"
							title={eventMetadata.label}
						>
							{eventMetadata.event && eventMetadata.eventValue && (
								<FilterButton
									active={isActive("event", eventMetadata.eventValue)}
									onClick={() => onFilterClick("event", eventMetadata.eventValue || "")}
								>
									<span className="block max-w-60 truncate">{eventMetadata.event}</span>
								</FilterButton>
							)}
							{eventMetadata.event && eventMetadata.year && <span>·</span>}
							{eventMetadata.year && (
								<FilterButton
									active={isActive("year", eventMetadata.year)}
									onClick={() => onFilterClick("year", eventMetadata.year || "")}
								>
									{eventMetadata.year}
								</FilterButton>
							)}
						</span>
					)}
				</div>
			</div>
		</article>
	);
}

function getEventMetadata(event: string | null, year: number | null) {
	const cleanEvent = event?.trim() || null;
	const cleanYear = year ? String(year) : null;
	if (!cleanEvent && !cleanYear) {
		return null;
	}
	const displayEvent =
		cleanEvent && cleanYear
			? cleanEvent.replace(new RegExp(`(?:\\s*[·–—-]?\\s*)${cleanYear}\\s*$`), "").trim() || null
			: cleanEvent;
	return {
		event: displayEvent,
		eventValue: cleanEvent,
		label: [displayEvent, cleanYear].filter(Boolean).join(" · "),
		year: cleanYear,
	};
}

function FilterButton({
	onClick,
	active,
	children,
}: {
	onClick: () => void;
	active: boolean;
	children: React.ReactNode;
}) {
	return (
		<button
			type="button"
			onClick={onClick}
			className={`-mx-1 cursor-pointer rounded-sm px-1 font-normal transition-colors ${
				active ? "text-accent-text" : "bg-panel-active text-text hover:bg-accent-soft"
			}`}
		>
			{children}
		</button>
	);
}

export { VideoCard };
