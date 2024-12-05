import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { sql, eq, desc } from "drizzle-orm";

import * as schema from "../schema";
import {
  dancers,
  dancersToCurations,
  orchestras,
  curations,
  videos,
  performances,
} from "../schema";

const dbPath = process.env.DATABASE_URL
  ? new URL(process.env.DATABASE_URL).pathname
  : "data/sqlite.db";
const sqlite = new Database(dbPath, {
  readonly: true,
});
// configure sqlite
sqlite.exec("pragma journal_mode = wal;");
sqlite.exec("pragma synchronous = normal;");
sqlite.exec("pragma busy_timeout = 5000;");
sqlite.exec("pragma cache_size = 2000;");
sqlite.exec("pragma temp_store = memory;");
sqlite.exec("pragma mmap_size = 268435456;");
sqlite.exec("pragma foreign_keys = on;");
export const db = drizzle({ client: sqlite, schema });

export async function getDancerOptions(otherDancer?: string) {
  if (!otherDancer || otherDancer === "any") {
    return await db
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
  }

  return await db
    .select({
      id: sql<number>`d1.id`,
      name: sql<string>`d1.name`,
      count: sql<number>`count(DISTINCT dc1.curation_id)`.as(
        "performanceCount"
      ),
    })
    .from(sql`${dancers} d1`)
    .innerJoin(sql`${dancersToCurations} dc1`, sql`d1.id = dc1.dancer_id`)
    .innerJoin(
      sql`${dancersToCurations} dc2`,
      sql`dc1.curation_id = dc2.curation_id`
    )
    .innerJoin(
      sql`${dancers} d2`,
      sql`d2.id = dc2.dancer_id AND d2.name = ${otherDancer} AND d2.id != d1.id`
    )
    .groupBy(sql`d1.id`, sql`d1.name`)
    .orderBy(sql`performanceCount DESC`);
}

export async function getOrchestraOptions(dancer1?: string, dancer2?: string) {
  if (dancer1 === "any" && dancer2 === "any") {
    return db
      .select({
        id: orchestras.id,
        name: orchestras.name,
        count: sql<number>`count(${curations.id})`.as("performanceCount"),
      })
      .from(orchestras)
      .leftJoin(curations, eq(orchestras.id, curations.orchestraId))
      .groupBy(orchestras.id, orchestras.name)
      .orderBy(sql`performanceCount DESC`);
  }

  const whereClause =
    dancer1 && dancer2 && dancer1 !== "any" && dancer2 !== "any"
      ? sql`d.name = ${dancer1} AND EXISTS (
       SELECT 1 FROM ${dancersToCurations} dc2
       INNER JOIN ${dancers} d2 ON dc2.dancer_id = d2.id
       WHERE dc2.curation_id = c.id AND d2.name = ${dancer2}
     )`
      : sql`d.name = ${dancer1 !== "any" ? dancer1 : dancer2}`;

  return await db
    .select({
      id: orchestras.id,
      name: orchestras.name,
      count: sql<number>`count(DISTINCT c.id)`.as("performanceCount"),
    })
    .from(orchestras)
    .innerJoin(sql`${curations} c`, sql`orchestras.id = c.orchestra_id`)
    .innerJoin(sql`${dancersToCurations} dc`, sql`c.id = dc.curation_id`)
    .innerJoin(sql`${dancers} d`, sql`dc.dancer_id = d.id`)
    .where(whereClause)
    .groupBy(orchestras.id, orchestras.name)
    .orderBy(sql`performanceCount DESC`);
}

export async function getFilteredVideos(
  dancer1?: string,
  dancer2?: string,
  orchestra?: string
) {
  let whereClause = sql`${curations.id} IS NOT NULL`;

  if (dancer1 !== "any" || dancer2 !== "any") {
    whereClause =
      dancer1 !== "any" && dancer2 !== "any"
        ? sql`${whereClause} AND d.name = ${dancer1} AND EXISTS (
           SELECT 1 FROM ${dancersToCurations} dc2
           INNER JOIN ${dancers} d2 ON dc2.dancer_id = d2.id
           WHERE dc2.curation_id = curations.id AND d2.name = ${dancer2}
         )`
        : sql`${whereClause} AND d.name = ${
            dancer1 !== "any" ? dancer1 : dancer2
          }`;
  }

  if (orchestra !== "any") {
    whereClause = sql`${whereClause} AND ${orchestras.name} = ${orchestra}`;
  }

  const results = await db
    .selectDistinct({
      id: videos.id,
      title: videos.title,
      channelTitle: videos.channelTitle,
      performance: performances,
      curation: curations,
    })
    .from(videos)
    .leftJoin(performances, eq(performances.videoId, videos.id))
    .leftJoin(curations, eq(curations.performanceId, performances.id))
    .innerJoin(
      sql`${dancersToCurations} dc`,
      sql`dc.curation_id = curations.id`
    )
    .innerJoin(sql`${dancers} d`, sql`dc.dancer_id = d.id`)
    .innerJoin(orchestras, eq(curations.orchestraId, orchestras.id))
    .where(whereClause)
    .orderBy(desc(videos.viewCount))
    .limit(12);

  return results.map((video) => ({
    id: video.id,
    title: video.title,
    channelTitle: video.channelTitle,
    dancers: video.performance?.dancers?.split(",") || [],
    songTitle: video.performance?.songTitle || "Unknown",
    orchestra: video.performance?.orchestra || "Unknown",
    singers: (video.performance?.singers?.split(",") || []).filter(Boolean),
    status: video.curation?.status,
  }));
}
