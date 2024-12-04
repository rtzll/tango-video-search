import { Box, Card, Flex, Text, Link, Badge, DataList } from "@radix-ui/themes";
import { ExternalLinkIcon } from "@radix-ui/react-icons";

export type Video = {
  id: string;
  title: string;
  channelTitle: string;
  dancers: string[];
  orchestra: string;
  songTitle: string;
  singers: string[];
  status: string;
};

// TODO: clicking on dancer or orchestra should send the user to the correct url
const VideoCard = ({ video }: { video: Video }) => {
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
          <DataList.Label minWidth="44px">
            Singer{video.singers.length > 1 ? "s" : ""}
          </DataList.Label>
          <DataList.Value>{video.singers.join(", ")}</DataList.Value>
        </DataList.Item>

        <DataList.Item>
          <DataList.Label minWidth="44px">Channel</DataList.Label>
          <DataList.Value>{video.channelTitle}</DataList.Value>
        </DataList.Item>
      </DataList.Root>
    </Card>
  );
};

export { VideoCard };
