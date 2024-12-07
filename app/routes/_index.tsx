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
import { json, LoaderFunctionArgs, type MetaFunction } from "@remix-run/node";
import { useLoaderData, useSearchParams } from "@remix-run/react";
import {
  getDancerOptions,
  getFilteredVideos,
  getOrchestraOptions,
} from "~/db.server";
import { VideoCard, type Video } from "~/components/video-card";
import { OptionsSelect } from "~/components/options-select";

export const meta: MetaFunction = () => {
  return [
    { title: "Tango Video Search" },
    { name: "description", content: "A different way to find tango videos." },
  ];
};

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const dancer1 = url.searchParams.get("dancer1") || "any";
  const dancer2 = url.searchParams.get("dancer2") || "any";
  const orchestra = url.searchParams.get("orchestra") || "any";

  // TODO: let orchestra influence dancers
  // when user is already set show all available options
  console.time("db");
  const dancerOneOptions = await getDancerOptions(dancer2);
  const dancerTwoOptions = await getDancerOptions(dancer1);
  const orchestraOptions = await getOrchestraOptions(dancer1, dancer2);
  const transformedVideos = await getFilteredVideos(
    dancer1,
    dancer2,
    orchestra
  );
  console.timeEnd("db");

  return json({
    dancerOneOptions,
    dancerTwoOptions,
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
        {/* TODO: consider using remix Form to get around issue with stale data */}
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
        <Callout.Root color="crimson" variant="surface">
          <Callout.Icon>
            <InfoCircledIcon />
          </Callout.Icon>
          <Callout.Text>
            <Strong>Note:</Strong> the data was extracted using AI and may not
            be accurate or complete.
          </Callout.Text>
        </Callout.Root>
      </Box>

      {/* TODO: add number of performances for filter and reset filter button */}
      {/* TODO: add pagination first */}
      <Grid
        columns={{ initial: "1", sm: "2", md: "3" }}
        gap="4"
        key={searchParams.toString()}
      >
        {initialVideos.map((video) => (
          <VideoCard video={video} key={video.id} />
        ))}
      </Grid>
    </Flex>
  );
};

export default SearchInterface;
