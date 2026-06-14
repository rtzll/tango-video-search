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
		<div className="bg-[var(--color-panel)] border border-[var(--color-border)] p-4">
			<a
				href={`https://youtube.com/watch?v=${video.id}`}
				target="_blank"
				rel="noopener noreferrer"
				className="font-medium text-[var(--color-accent-text)] hover:underline inline-flex items-baseline gap-1"
			>
				<span>{video.title}</span>
				<ExternalLinkIcon className="shrink-0" />
			</a>

			<dl className="mt-3 grid grid-cols-[max-content_1fr] gap-x-4 gap-y-2 text-xs">
				<dt className="text-[var(--color-muted)] min-w-[44px]">Dancers</dt>
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

				<dt className="text-[var(--color-muted)] min-w-[44px]">Orchestra</dt>
				<dd>
					<FilterButton
						onClick={() => onFilterClick("orchestra", video.orchestra)}
						active={isActive("orchestra", video.orchestra)}
					>
						{video.orchestra}
					</FilterButton>
				</dd>

				<dt className="text-[var(--color-muted)] min-w-[44px]">Song</dt>
				<dd>{video.songTitle}</dd>

				{video.singers.length > 0 && (
					<>
						<dt className="text-[var(--color-muted)] min-w-[44px]">
							Singer{video.singers.length > 1 ? "s" : ""}
						</dt>
						<dd>{video.singers.join(", ")}</dd>
					</>
				)}

				<dt className="text-[var(--color-muted)] min-w-[44px]">Channel</dt>
				<dd>
					<a
						href={`https://youtube.com/channel/${video.channelId}`}
						target="_blank"
						rel="noopener noreferrer"
						className="text-[var(--color-accent-text)] hover:underline inline-flex items-end gap-1"
					>
						<span>{video.channelTitle}</span>
						<ExternalLinkIcon className="shrink-0" />
					</a>
				</dd>

				<dt className="text-[var(--color-muted)] min-w-[44px]">Year</dt>
				<dd>{video.year}</dd>
			</dl>
		</div>
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
			className={`text-[var(--color-accent-text)] hover:underline cursor-pointer ${
				active ? "font-bold" : ""
			}`}
		>
			{children}
		</button>
	);
}

export { VideoCard };
