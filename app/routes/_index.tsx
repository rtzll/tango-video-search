import {
	ChevronLeftIcon,
	ChevronRightIcon,
	GitHubLogoIcon,
	ResetIcon,
} from "@radix-ui/react-icons";
import {
	Box,
	Button,
	Flex,
	Grid,
	IconButton,
	Link,
	Text,
} from "@radix-ui/themes";
import { useSearchParams } from "react-router";
import { Combobox } from "~/components/combobox";
import { VideoCard } from "~/components/video-card";
import {
	getDancerOptions,
	getFilteredVideos,
	getFilteredVideosCount,
	getLastDatabaseUpdateTime,
	getOrchestraOptions,
} from "~/db.server";
import { normalizeName } from "~/utils/normalize";
import type { Route } from "./+types/_index";

const PAGE_SIZE = 42;

export function meta() {
	return [
		{ title: "Tango Video Search" },
		{ name: "description", content: "A different way to find tango videos." },
	];
}

export async function loader({ request }: Route.LoaderArgs) {
	const url = new URL(request.url);
	const dancer1 = url.searchParams.get("dancer1") || "any";
	const dancer2 = url.searchParams.get("dancer2") || "any";
	const orchestra = url.searchParams.get("orchestra") || "any";
	const pageParam = url.searchParams.get("page");
	const page = Math.max(1, Number.parseInt(pageParam || "1", 10) || 1);

	const [dancerOneOptions, dancerTwoOptions, orchestraOptions, totalVideos] =
		await Promise.all([
			getDancerOptions(dancer2, orchestra),
			getDancerOptions(dancer1, orchestra),
			getOrchestraOptions(dancer1, dancer2),
			getFilteredVideosCount(dancer1, dancer2, orchestra),
		]);
	const totalPages = Math.max(1, Math.ceil(totalVideos / PAGE_SIZE));
	const safePage = Math.min(page, totalPages);
	const transformedVideos = await getFilteredVideos(
		dancer1,
		dancer2,
		orchestra,
		safePage,
		PAGE_SIZE,
	);

	const lastUpdateTime = getLastDatabaseUpdateTime();
	const formattedLastUpdate = lastUpdateTime
		? new Intl.DateTimeFormat("en-US", {
				year: "numeric",
				month: "long",
				day: "numeric",
				timeZone: "UTC",
			}).format(lastUpdateTime)
		: "Unknown";

	return {
		dancerOneOptions,
		dancerTwoOptions,
		orchestraOptions,
		initialVideos: transformedVideos,
		formattedLastUpdate,
		page: safePage,
		totalPages,
		totalVideos,
	};
}

export default function SearchInterface({ loaderData }: Route.ComponentProps) {
	const {
		dancerOneOptions,
		dancerTwoOptions,
		orchestraOptions,
		initialVideos,
		formattedLastUpdate,
		page,
		totalPages,
		totalVideos,
	} = loaderData;

	const [searchParams, setSearchParams] = useSearchParams();
	const dancer1 = searchParams.get("dancer1") || "any";
	const dancer2 = searchParams.get("dancer2") || "any";
	const orchestra = searchParams.get("orchestra") || "any";

	const updateSearchParam = (param: string, value: string) => {
		const newParams = new URLSearchParams(searchParams);
		if (value === "any") {
			newParams.delete(param);
		} else {
			newParams.set(param, value);
		}
		newParams.delete("page");
		setSearchParams(newParams);
	};
	const resetSearchParams = () => setSearchParams(new URLSearchParams());
	const isSameFilterValue = (current: string, candidate: string) =>
		current !== "any" && normalizeName(current) === normalizeName(candidate);

	const handleFilterClick = (type: "dancer" | "orchestra", value: string) => {
		const newParams = new URLSearchParams(searchParams);

		if (type === "dancer") {
			if (isSameFilterValue(dancer1, value)) {
				newParams.delete("dancer1");
			} else if (isSameFilterValue(dancer2, value)) {
				newParams.delete("dancer2");
			} else if (dancer1 === "any" && dancer2 === "any") {
				newParams.set("dancer1", value);
			} else if (
				dancer1 !== "any" &&
				dancer2 === "any" &&
				!isSameFilterValue(dancer1, value)
			) {
				newParams.set("dancer2", value);
			} else if (
				dancer1 === "any" &&
				dancer2 !== "any" &&
				!isSameFilterValue(dancer2, value)
			) {
				newParams.set("dancer1", value);
			}
		} else if (type === "orchestra") {
			isSameFilterValue(orchestra, value)
				? newParams.delete("orchestra")
				: newParams.set("orchestra", value);
		}

		newParams.delete("page");
		setSearchParams(newParams);
	};
	const updatePage = (nextPage: number) => {
		const newParams = new URLSearchParams(searchParams);
		if (nextPage <= 1) {
			newParams.delete("page");
		} else {
			newParams.set("page", String(nextPage));
		}
		setSearchParams(newParams);
	};

	const startIndex = totalVideos === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
	const endIndex = Math.min(page * PAGE_SIZE, totalVideos);

	return (
		<Flex
			direction="column"
			gap="6"
			className="p-6"
			maxWidth="1400px"
			mx="auto"
			style={{ minHeight: "100vh" }}
		>
			<Box>
				<Flex align="baseline" gap="2" className="flex-wrap">
					<Text>I want to see</Text>
					<Combobox
						value={dancer1}
						onValueChange={(value) => updateSearchParam("dancer1", value)}
						options={dancerOneOptions}
						placeholder="any dancer"
						searchLabel="dancer"
						ariaLabel="Select first dancer"
					/>
					<Text>and</Text>
					<Combobox
						value={dancer2}
						onValueChange={(value) => updateSearchParam("dancer2", value)}
						options={dancerTwoOptions}
						placeholder="any dancer"
						searchLabel="dancer"
						ariaLabel="Select second dancer"
					/>
					<Text>dance to</Text>
					{/* TODO: allow for selecting songs and singers too */}
					<Combobox
						value={orchestra}
						onValueChange={(value) => updateSearchParam("orchestra", value)}
						options={orchestraOptions}
						placeholder="any orchestra"
						searchLabel="orchestra"
						ariaLabel="Select orchestra"
					/>
					{(dancer1 !== "any" || dancer2 !== "any" || orchestra !== "any") && (
						<IconButton
							size="1"
							variant="soft"
							onClick={resetSearchParams}
							aria-label="Reset filters"
						>
							<ResetIcon width={12} height={12} />
						</IconButton>
					)}
				</Flex>
			</Box>

			{/* TODO: add number of performances for filter and reset filter button */}
			<Grid
				columns={{ initial: "1", sm: "2", md: "3" }}
				gap="4"
				key={searchParams.toString()}
			>
				{initialVideos.map((video) => (
					<VideoCard
						video={video}
						key={video.id}
						onFilterClick={handleFilterClick}
						activeFilters={{
							dancers: [dancer1, dancer2],
							orchestra,
						}}
					/>
				))}
			</Grid>

			<Flex align="center" justify="between" gap="3" className="flex-wrap">
				<Text size="1" color="gray">
					{totalVideos === 0
						? "No results"
						: `Showing ${startIndex}–${endIndex} of ${totalVideos}`}
				</Text>
				<Flex align="center" gap="2">
					<Button
						size="1"
						variant="outline"
						disabled={page <= 1}
						onClick={() => updatePage(page - 1)}
					>
						<span className="inline-flex items-center gap-1">
							<ChevronLeftIcon width={14} height={14} />
							Previous
						</span>
					</Button>
					<Text size="1" color="gray">
						Page {page} of {totalPages}
					</Text>
					<Button
						size="1"
						variant="outline"
						disabled={page >= totalPages}
						onClick={() => updatePage(page + 1)}
					>
						<span className="inline-flex items-center gap-1">
							Next
							<ChevronRightIcon width={14} height={14} />
						</span>
					</Button>
				</Flex>
			</Flex>

			<Box mt="auto" pt="4">
				<Flex align="baseline" className="justify-between flex-wrap">
					<Text size="1" color="gray">
						Data refreshed: {formattedLastUpdate}
					</Text>
					<Link
						href="https://github.com/rtzll/tango-video-search"
						target="_blank"
						rel="noopener noreferrer"
						className="hover:underline"
						size="1"
						color="gray"
					>
						<span
							style={{
								display: "inline-flex",
								alignItems: "center",
								gap: "4px",
							}}
						>
							Source code
							<GitHubLogoIcon width={12} height={12} />
						</span>
					</Link>
				</Flex>
			</Box>
		</Flex>
	);
}
