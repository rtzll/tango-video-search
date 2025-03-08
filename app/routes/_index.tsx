import { Box, Flex, Text, Grid, IconButton } from "@radix-ui/themes";
import { ResetIcon } from "@radix-ui/react-icons";
import { useLoaderData, useSearchParams } from "react-router";
import type { Route } from "./+types/_index";
import {
  getDancerOptions,
  getFilteredVideos,
  getOrchestraOptions,
} from "~/db.server";
import { VideoCard, type Video } from "~/components/video-card";
import { OptionsSelect } from "~/components/options-select";

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

  const [
    dancerOneOptions,
    dancerTwoOptions,
    orchestraOptions,
    transformedVideos,
  ] = await Promise.all([
    getDancerOptions(dancer2, orchestra),
    getDancerOptions(dancer1, orchestra),
    getOrchestraOptions(dancer1, dancer2),
    getFilteredVideos(dancer1, dancer2, orchestra),
  ]);

  return {
    dancerOneOptions,
    dancerTwoOptions,
    orchestraOptions,
    initialVideos: transformedVideos as Video[],
  };
}

export default function SearchInterface({ loaderData }: Route.ComponentProps) {
  const {
    dancerOneOptions,
    dancerTwoOptions,
    orchestraOptions,
    initialVideos,
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
    setSearchParams(newParams);
  };
  const resetSearchParams = () => setSearchParams(new URLSearchParams());

  const handleFilterClick = (type: "dancer" | "orchestra", value: string) => {
    const newParams = new URLSearchParams(searchParams);

    if (type === "dancer") {
      if (dancer1 === value) {
        newParams.delete("dancer1");
      } else if (dancer2 === value) {
        newParams.delete("dancer2");
      } else if (dancer1 === "any" && dancer2 === "any") {
        newParams.set("dancer1", value);
      } else if (dancer1 !== "any" && dancer2 === "any" && dancer1 !== value) {
        newParams.set("dancer2", value);
      } else if (dancer1 === "any" && dancer2 !== "any" && dancer2 !== value) {
        newParams.set("dancer1", value);
      }
    } else if (type === "orchestra") {
      orchestra === value
        ? newParams.delete("orchestra")
        : newParams.set("orchestra", value);
    }

    setSearchParams(newParams);
  };

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

      {/* TODO: add number of performances for filter and reset filter button */}
      {/* TODO: add pagination first */}
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
    </Flex>
  );
}
