import { useState } from "react";
import {
  Box,
  Card,
  Flex,
  Text,
  Select,
  Grid,
  Link,
  Badge,
  Callout,
  Strong,
  DataList,
} from "@radix-ui/themes";
import { ExternalLinkIcon, InfoCircledIcon } from "@radix-ui/react-icons";
import { json, type MetaFunction } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";

import { db } from "~/db.server";
import { eq } from "drizzle-orm";
import { dancers, videos, performances, curations } from "../../schema";

export const meta: MetaFunction = () => {
  return [
    { title: "Tango Video Search" },
    { name: "description", content: "A different way to find tango videos." },
  ];
};

type Video = {
  id: string;
  title: string;
  channelTitle: string;
  thumbnail: string;
  dancers: string[];
  orchestra: string;
  songTitle: string;
  singers: string[];
  status: string;
};

type LoaderData = {
  dancers: { id: number; name: string }[];
  initialVideos: Video[];
};

export async function loader() {
  const dancersList = await db
    .select({
      id: dancers.id,
      name: dancers.name,
    })
    .from(dancers);

  // Get initial videos with their related data
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
    .limit(12);

  // Transform the data for the frontend
  const transformedVideos = initialVideos.map((video) => ({
    id: video.id,
    title: video.title,
    channelTitle: video.channelTitle,
    dancers: video.performance?.dancers?.split(",") || [],
    songTitle: video.performance?.songTitle || "Unknown",
    orchestra: video.performance?.orchestra || "Unknown",
    singers: video.performance?.singers?.split(",") || [],
    status: video.curation?.status,
  }));

  return json({
    dancers: dancersList,
    initialVideos: transformedVideos,
  });
}

const SearchInterface = () => {
  const { dancers: allDancers, initialVideos } = useLoaderData<LoaderData>();
  const [dancer1, setDancer1] = useState<string>("any");
  const [dancer2, setDancer2] = useState<string>("any");
  const [music, setMusic] = useState<string>("any");

  // Filter available partners based on dancer1 selection
  const availablePartners =
    dancer1 === "any"
      ? allDancers
      : allDancers.filter((d) => d.id !== parseInt(dancer1));

  return (
    <Flex direction="column" gap="6" className="p-6">
      <Box>
        <Flex align="center" gap="2" className="flex-wrap">
          <Text>I want to see</Text>

          <Select.Root value={dancer1} onValueChange={setDancer1}>
            <Select.Trigger placeholder="any dancer" className="w-32" />
            <Select.Content>
              <Select.Group>
                <Select.Item value="any">any dancer</Select.Item>
                {allDancers.map((dancer) => (
                  <Select.Item key={dancer.id} value={dancer.id.toString()}>
                    {dancer.name}
                  </Select.Item>
                ))}
              </Select.Group>
            </Select.Content>
          </Select.Root>

          <Text>and</Text>

          <Select.Root value={dancer2} onValueChange={setDancer2}>
            <Select.Trigger placeholder="any dancer" className="w-32" />
            <Select.Content>
              <Select.Group>
                <Select.Item value="any">any dancer</Select.Item>
                {availablePartners.map((dancer) => (
                  <Select.Item key={dancer.id} value={dancer.id.toString()}>
                    {dancer.name}
                  </Select.Item>
                ))}
              </Select.Group>
            </Select.Content>
          </Select.Root>

          <Text>dance to</Text>

          <Select.Root value={music} onValueChange={setMusic}>
            <Select.Trigger
              placeholder="any music"
              className="w-40"
            ></Select.Trigger>
            <Select.Content>
              <Select.Group>
                <Select.Item value="any">any music</Select.Item>
                {/* We'll add orchestra/song/singer options here */}
              </Select.Group>
            </Select.Content>
          </Select.Root>
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

      <Grid columns={{ initial: "1", sm: "2", md: "3" }} gap="4">
        {initialVideos.map((video) => (
          <VideoCard video={video} key={video.id} />
        ))}
      </Grid>
    </Flex>
  );
};

const VideoCard = ({ video }: { video: Video }) => {
  return (
    <Card key={video.id}>
      <Flex direction="column" gap="2">
        <Link
          href={`https://youtube.com/watch?v=${video.id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium hover:underline flex items-center gap-2"
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
          <DataList.Label minWidth="44px">Status</DataList.Label>
          <DataList.Value>
            <Badge color="blue">{video.status}</Badge>
          </DataList.Value>
        </DataList.Item>

        <DataList.Item>
          <DataList.Label minWidth="44px">Dancers</DataList.Label>
          <DataList.Value>{video.dancers.join(", ")}</DataList.Value>
        </DataList.Item>

        <DataList.Item>
          <DataList.Label minWidth="44px">Orchestra</DataList.Label>
          <DataList.Value>{video.orchestra}</DataList.Value>
        </DataList.Item>

        <DataList.Item>
          <DataList.Label minWidth="44px">Song</DataList.Label>
          <DataList.Value>{video.songTitle}</DataList.Value>
        </DataList.Item>

        <DataList.Item>
          <DataList.Label minWidth="44px">Channel</DataList.Label>
          <DataList.Value>{video.channelTitle}</DataList.Value>
        </DataList.Item>
      </DataList.Root>
    </Card>
  );
};

export default SearchInterface;
