import { ExternalLinkIcon } from "@radix-ui/react-icons";

import { ANY_FILTER_VALUE } from "~/utils/filters";
import { normalizeName } from "~/utils/normalize";

interface Video {
	id: string;
	title: string;
	channelTitle: string;
	channelId: string;
	dancers: string[];
	orchestra: string;
	songTitle: string;
	singers: string[];
	year: number;
}

interface VideoCardProps {
	video: Video;
	onFilterClick: (type: "dancer" | "orchestra", value: string) => void;
	activeFilters: {
		dancers: string[];
		orchestra: string;
	};
}

function VideoCard({ video, onFilterClick, activeFilters }: VideoCardProps) {
	const isActive = (type: "dancer" | "orchestra", value: string) => {
		const normalizedValue = normalizeName(value);
		if (type === "dancer") {
			return activeFilters.dancers.some(
				(dancer) => dancer !== ANY_FILTER_VALUE && normalizeName(dancer) === normalizedValue,
			);
		}
		return (
			activeFilters.orchestra !== ANY_FILTER_VALUE &&
			normalizeName(activeFilters.orchestra) === normalizedValue
		);
	};

	return (
		<article className="border-border bg-panel flex flex-col overflow-hidden border">
			<a
				href={`https://youtube.com/watch?v=${video.id}`}
				target="_blank"
				rel="noopener noreferrer"
				aria-label={`Watch ${video.title} on YouTube`}
				className="bg-panel-hover group relative aspect-video overflow-hidden"
			>
				<img
					src={`https://i.ytimg.com/vi/${video.id}/hqdefault.jpg`}
					alt=""
					loading="lazy"
					className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.02]"
				/>
				<span className="absolute inset-0 bg-black/0 transition-colors group-hover:bg-black/10" />
			</a>

			<div className="flex flex-1 flex-col p-4">
				<a
					href={`https://youtube.com/watch?v=${video.id}`}
					target="_blank"
					rel="noopener noreferrer"
					className="text-text hover:text-accent-text inline-flex items-baseline gap-1 text-base leading-snug font-semibold"
				>
					<span>{video.title}</span>
					<ExternalLinkIcon className="shrink-0" />
				</a>

				<dl className="mt-4 grid grid-cols-[max-content_1fr] gap-x-4 gap-y-2 text-sm">
					<dt className="text-muted min-w-[44px]">Dancers</dt>
					<dd className="flex flex-wrap">
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
					</dd>

					<dt className="text-muted min-w-[44px]">Orchestra</dt>
					<dd>
						<FilterButton
							onClick={() => onFilterClick("orchestra", video.orchestra)}
							active={isActive("orchestra", video.orchestra)}
						>
							{video.orchestra}
						</FilterButton>
					</dd>

					<dt className="text-muted min-w-[44px]">Song</dt>
					<dd>{video.songTitle}</dd>

					{video.singers.length > 0 && (
						<>
							<dt className="text-muted min-w-[44px]">
								Singer{video.singers.length > 1 ? "s" : ""}
							</dt>
							<dd>{video.singers.join(", ")}</dd>
						</>
					)}
				</dl>

				<div className="border-border text-muted mt-auto flex items-end justify-between gap-3 border-t pt-3 text-xs">
					<a
						href={`https://youtube.com/channel/${video.channelId}`}
						target="_blank"
						rel="noopener noreferrer"
						className="hover:text-accent-text inline-flex min-w-0 items-end gap-1 hover:underline"
					>
						<span className="truncate">{video.channelTitle}</span>
						<ExternalLinkIcon className="shrink-0" />
					</a>
					<span className="shrink-0">{video.year}</span>
				</div>
			</div>
		</article>
	);
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
			className={`text-accent-text cursor-pointer hover:underline ${active ? "font-bold" : ""}`}
		>
			{children}
		</button>
	);
}

export { VideoCard };
