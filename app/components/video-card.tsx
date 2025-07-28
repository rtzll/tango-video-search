import { ExternalLinkIcon } from "@radix-ui/react-icons";
import {
	Box,
	Button,
	Card,
	DataList,
	Flex,
	Link,
	Text,
} from "@radix-ui/themes";

export type Video = {
	id: string;
	title: string;
	channelTitle: string;
	channelId: string;
	dancers: string[];
	orchestra: string;
	songTitle: string;
	singers: string[];
	status: string;
	year: number;
};

type VideoCardProps = {
	video: Video;
	onFilterClick: (type: "dancer" | "orchestra", value: string) => void;
	activeFilters: {
		dancers: string[];
		orchestra: string;
	};
};
function VideoCard({ video, onFilterClick, activeFilters }: VideoCardProps) {
	const isActive = (type: "dancer" | "orchestra", value: string) => {
		if (type === "dancer") {
			return activeFilters.dancers.includes(value);
		}
		return activeFilters.orchestra === value;
	};
	return (
		<Card key={video.id}>
			<Flex direction="column" gap="2">
				<Link
					href={`https://youtube.com/watch?v=${video.id}`}
					target="_blank"
					rel="noopener noreferrer"
					className="font-medium hover:underline flex items-center"
				>
					<Flex gap="1" align="baseline">
						<Text>{video.title}</Text>
						<Box>
							<ExternalLinkIcon />
						</Box>
					</Flex>
				</Link>
			</Flex>

			<DataList.Root size="1" mt="3">
				<DataList.Item>
					<DataList.Label minWidth="44px">Dancers</DataList.Label>
					<DataList.Value>
						<Flex wrap="wrap">
							{video.dancers.map((dancer, index) => (
								<span key={`${video.id}-${dancer}`}>
									<Button
										variant="ghost"
										size="1"
										onClick={() => onFilterClick("dancer", dancer)}
										className={`hover:underline cursor-pointer ${
											isActive("dancer", dancer) ? "font-bold" : ""
										}`}
									>
										{dancer}
									</Button>
									{index < video.dancers.length - 1 ? (
										<span className="mr-1">{" and "}</span>
									) : (
										""
									)}
								</span>
							))}
						</Flex>
					</DataList.Value>
				</DataList.Item>

				<DataList.Item>
					<DataList.Label minWidth="44px">Orchestra</DataList.Label>
					<DataList.Value>
						<Button
							variant="ghost"
							size="1"
							onClick={() => onFilterClick("orchestra", video.orchestra)}
							className={`hover:underline cursor-pointer ${
								isActive("orchestra", video.orchestra) ? "font-bold" : ""
							}`}
						>
							{video.orchestra}
						</Button>
					</DataList.Value>
				</DataList.Item>

				<DataList.Item>
					<DataList.Label minWidth="44px">Song</DataList.Label>
					<DataList.Value>{video.songTitle}</DataList.Value>
				</DataList.Item>

				{video.singers.length > 0 && (
					<DataList.Item>
						<DataList.Label minWidth="44px">
							Singer{video.singers.length > 1 ? "s" : ""}
						</DataList.Label>
						<DataList.Value>{video.singers.join(", ")}</DataList.Value>
					</DataList.Item>
				)}

				<DataList.Item>
					<DataList.Label minWidth="44px">Channel</DataList.Label>
					<DataList.Value>
						<Link
							href={`https://youtube.com/channel/${video.channelId}`}
							target="_blank"
							rel="noopener noreferrer"
							className="hover:underline flex items-center"
						>
							<Flex gap="1" align="end">
								<Text>{video.channelTitle}</Text>
								<ExternalLinkIcon />
							</Flex>
						</Link>
					</DataList.Value>
				</DataList.Item>

				<DataList.Item>
					<DataList.Label minWidth="44px">Year</DataList.Label>
					<DataList.Value>{video.year}</DataList.Value>
				</DataList.Item>
			</DataList.Root>
		</Card>
	);
}

export { VideoCard };
