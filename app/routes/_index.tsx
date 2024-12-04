import {
  Box,
  Flex,
  Text,
  Grid,
  Callout,
  Strong,
  IconButton,
} from "@radix-ui/themes";
import { InfoCircledIcon, ResetIcon } from "@radix-ui/react-icons";
import { json, type MetaFunction } from "@remix-run/node";
import { useLoaderData, useSearchParams } from "@remix-run/react";
import { desc, eq, isNotNull, sql } from "drizzle-orm";

import { db } from "~/db.server";
import {
  dancers,
  dancersToCurations,
  videos,
  performances,
  orchestras,
  curations,
} from "../../schema";
import { VideoCard, type Video } from "~/components/video-card";
import { OptionsSelect } from "~/components/options-select";
import { normalize } from "lib/normailze";

export const meta: MetaFunction = () => {
  return [
    { title: "Tango Video Search" },
    { name: "description", content: "A different way to find tango videos." },
  ];
};

export async function loader() {
  // TODO: make dancer options depend on the dancers in the URL
  // const url = new URL(request.url);
  //
  // const dancer1 = url.searchParams.get("dancer1") || "any";
  // const dancer2 = url.searchParams.get("dancer2") || "any";
  const dancerOptions = await db
    .select({
      id: dancers.id,
      name: dancers.name,
      count: sql<number>`count(${dancersToCurations.curationId})`.as(
        "performanceCount"
      ),
    })
    .from(dancers)
    .leftJoin(dancersToCurations, eq(dancers.id, dancersToCurations.dancerId))
    .groupBy(dancers.id, dancers.name)
    .orderBy(sql`performanceCount DESC`);

  const orchestraOptions = await db
    .select({
      id: orchestras.id,
      name: orchestras.name,
      count: sql<number>`count(${curations.id})`.as("performanceCount"),
    })
    .from(orchestras)
    .leftJoin(curations, eq(orchestras.id, curations.orchestraId))
    .groupBy(orchestras.id, orchestras.name)
    .orderBy(sql`performanceCount DESC`);

  // Get initial videos with their related data, ordered by view count
  // TODO: only fetch recommended videos (via status?)
  const initialVideos = await db
    .select({
      id: videos.id,
      title: videos.title,
      channelTitle: videos.channelTitle,
      performance: performances,
      curation: curations,
    })
    .from(videos)
    .leftJoin(performances, eq(performances.videoId, videos.id))
    .leftJoin(curations, eq(curations.performanceId, performances.id))
    .where(isNotNull(curations.id))
    .orderBy(desc(videos.viewCount))
    .limit(12);

  // Transform the data for the frontend
  const transformedVideos = initialVideos.map((video) => ({
    id: video.id,
    title: video.title,
    channelTitle: video.channelTitle,
    dancers: video.performance?.dancers?.split(",") || [],
    songTitle: video.performance?.songTitle || "Unknown",
    orchestra: video.performance?.orchestra || "Unknown",
    singers: (video.performance?.singers?.split(",") || []).filter((singer) =>
      singer.trim()
    ),
    status: video.curation?.status,
  }));

  return json({
    dancerOneOptions: dancerOptions,
    dancerTwoOptions: dancerOptions,
    orchestraOptions,
    initialVideos: transformedVideos as Video[],
  });
}

const SearchInterface = () => {
  const {
    dancerOneOptions,
    dancerTwoOptions,
    orchestraOptions,
    initialVideos,
  } = useLoaderData<typeof loader>();
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
    setSearchParams(newParams);
  };

  const resetSearchParams = () => setSearchParams(new URLSearchParams());

  return (
    <Flex direction="column" gap="6" className="p-6">
      <Box>
        <Flex align="baseline" gap="2" className="flex-wrap">
          <Text>I want to see</Text>
          <OptionsSelect
            value={dancer1}
            onValueChange={(value) => updateSearchParam("dancer1", value)}
            options={dancerOneOptions}
            placeholder="any dancer"
          />
          <Text>and</Text>
          <OptionsSelect
            value={dancer2}
            onValueChange={(value) => updateSearchParam("dancer2", value)}
            options={dancerTwoOptions}
            placeholder="any dancer"
          />
          <Text>dance to</Text>
          {/* TODO: allow for selecting songs and singers too */}
          <OptionsSelect
            value={orchestra}
            onValueChange={(value) => updateSearchParam("orchestra", value)}
            options={orchestraOptions}
            placeholder="any orchestra"
          />
          <Text>.</Text>
          {(dancer1 !== "any" || dancer2 !== "any" || orchestra !== "any") && (
            <IconButton size="1" variant="soft" onClick={resetSearchParams}>
              <ResetIcon width={12} height={12} />
            </IconButton>
          )}
        </Flex>
      </Box>

      <Box>
        <Callout.Root color="blue" variant="surface">
          <Callout.Icon>
            <InfoCircledIcon />
          </Callout.Icon>
          <Callout.Text>
            <Strong>Note:</Strong> the data may not be accurate or complete. It
            was extracted using AI.
          </Callout.Text>
        </Callout.Root>
      </Box>

      {/* TODO: add number of performances for filter and reset filter button */}
      <Grid columns={{ initial: "1", sm: "2", md: "3" }} gap="4">
        {initialVideos.map((video) => (
          <VideoCard video={video} key={video.id} />
        ))}
      </Grid>
    </Flex>
  );
};

export default SearchInterface;
