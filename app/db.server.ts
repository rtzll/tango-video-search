import { Database } from "bun:sqlite";
import { statSync } from "node:fs";
import { desc, eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/bun-sqlite";

import * as schema from "../schema";
import {
	curations,
	dancers,
	dancersToCurations,
	orchestras,
	performances,
	videos,
} from "../schema";
import { normalizeName } from "./utils/normalize";

const dbPath = process.env.DATABASE_URL
	? new URL(process.env.DATABASE_URL).pathname
	: "data/sqlite.db";
const sqlite = new Database(dbPath, {
	readonly: true,
});
// configure sqlite
sqlite.query("pragma synchronous = normal;").run();
sqlite.query("pragma busy_timeout = 5000;").run();
sqlite.query("pragma cache_size = 2000;").run();
sqlite.query("pragma temp_store = memory;").run();
sqlite.query("pragma mmap_size = 268435456;").run();
sqlite.query("pragma foreign_keys = on;").run();
const db = drizzle({ client: sqlite, schema });

export function getLastDatabaseUpdateTime() {
	try {
		const stats = statSync(dbPath);
		return stats.mtime;
	} catch (error) {
		console.error("Error getting database file stats:", error);
		return null;
	}
}

export async function getDancerOptions(otherDancer: string, orchestra: string) {
	const normalizedOrchestra =
		orchestra === "any" ? "any" : normalizeName(orchestra);

	if (otherDancer === "any") {
		return await db
			.select({
				id: dancers.id,
				name: dancers.name,
				count: sql<number>`count(${dancersToCurations.curationId})`.as(
					"performanceCount",
				),
			})
			.from(dancers)
			.leftJoin(dancersToCurations, eq(dancers.id, dancersToCurations.dancerId))
			.innerJoin(curations, eq(dancersToCurations.curationId, curations.id))
			.innerJoin(orchestras, eq(curations.orchestraId, orchestras.id))
			.where(
				orchestra === "any"
					? sql`1`
					: eq(orchestras.normalized, normalizedOrchestra),
			)
			.groupBy(dancers.id, dancers.name)
			.having(sql`performanceCount > 0`)
			.orderBy(sql`performanceCount DESC`);
	}

	const normalizedOtherDancer = normalizeName(otherDancer);

	return await db
		.select({
			id: sql<number>`d1.id`,
			name: sql<string>`d1.name`,
			count: sql<number>`count(DISTINCT dc1.curation_id)`.as(
				"performanceCount",
			),
		})
		.from(sql`${dancers} d1`)
		.innerJoin(sql`${dancersToCurations} dc1`, sql`d1.id = dc1.dancer_id`)
		.innerJoin(
			sql`${dancersToCurations} dc2`,
			sql`dc1.curation_id = dc2.curation_id`,
		)
		.innerJoin(
			sql`${dancers} d2`,
			sql`d2.id = dc2.dancer_id AND d2.normalized = ${normalizedOtherDancer} AND d2.id != d1.id`,
		)
		.innerJoin(curations, sql`dc1.curation_id = ${curations.id}`)
		.innerJoin(orchestras, eq(curations.orchestraId, orchestras.id))
		.where(
			orchestra === "any"
				? sql`1`
				: eq(orchestras.normalized, normalizedOrchestra),
		)
		.groupBy(sql`d1.id`, sql`d1.name`)
		.having(sql`performanceCount > 0`)
		.orderBy(sql`performanceCount DESC`);
}

export async function getOrchestraOptions(dancer1: string, dancer2: string) {
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
			.having(sql`performanceCount > 0`)
			.orderBy(sql`performanceCount DESC`);
	}

	return await db
		.select({
			id: orchestras.id,
			name: orchestras.name,
			count: sql<number>`count(DISTINCT ${curations.id})`.as(
				"performanceCount",
			),
		})
		.from(orchestras)
		.innerJoin(curations, eq(orchestras.id, curations.orchestraId))
		.innerJoin(
			dancersToCurations,
			eq(curations.id, dancersToCurations.curationId),
		)
		.innerJoin(dancers, eq(dancers.id, dancersToCurations.dancerId))
		.where(dancerClause(dancer1, dancer2))
		.groupBy(orchestras.id, orchestras.name)
		.having(sql`performanceCount > 0`)
		.orderBy(sql`performanceCount DESC`);
}

// made me chuckle
function dancerClause(dancer1: string, dancer2: string) {
	const dancer1Normalized = dancer1 === "any" ? "any" : normalizeName(dancer1);
	const dancer2Normalized = dancer2 === "any" ? "any" : normalizeName(dancer2);

	if (dancer1Normalized !== "any" && dancer2Normalized !== "any") {
		return sql`${dancers.normalized} = ${dancer1Normalized} AND EXISTS (
    SELECT 1 FROM ${dancersToCurations} dc2
    INNER JOIN ${dancers} d2 ON dc2.dancer_id = d2.id
    WHERE dc2.curation_id = ${curations.id} AND d2.normalized = ${dancer2Normalized})`;
	}

	const active =
		dancer1Normalized !== "any" ? dancer1Normalized : dancer2Normalized;
	return sql`${dancers.normalized} = ${active}`;
}

export async function getFilteredVideos(
	dancer1: string,
	dancer2: string,
	orchestra: string,
) {
	let whereClause = sql`${curations.id} IS NOT NULL`;

	if (dancer1 !== "any" || dancer2 !== "any") {
		whereClause = sql`${whereClause} AND ${dancerClause(dancer1, dancer2)}`;
	}
	if (orchestra !== "any") {
		whereClause = sql`${whereClause} AND ${orchestras.normalized} = ${normalizeName(orchestra)}`;
	}

	const results = await db
		.selectDistinct({
			id: videos.id,
			title: videos.title,
			channelTitle: videos.channelTitle,
			channelId: videos.channelId,
			performance: performances,
			curation: curations,
		})
		.from(videos)
		.leftJoin(performances, eq(performances.videoId, videos.id))
		.leftJoin(curations, eq(curations.performanceId, performances.id))
		.innerJoin(
			dancersToCurations,
			eq(curations.id, dancersToCurations.curationId),
		)
		.innerJoin(dancers, eq(dancers.id, dancersToCurations.dancerId))
		.innerJoin(orchestras, eq(curations.orchestraId, orchestras.id))
		.where(whereClause)
		.orderBy(desc(videos.publishedAt))
		.limit(42);

	return results.map((video) => ({
		id: video.id,
		title: video.title,
		channelTitle: video.channelTitle,
		channelId: video.channelId,
		dancers: video.performance?.dancers?.split(",").map((d) => d.trim()) || [],
		songTitle: video.performance?.songTitle || "Unknown",
		orchestra: video.performance?.orchestra || "Unknown",
		singers: (video.performance?.singers?.split(",") || []).filter(Boolean),
		year: video.performance?.performanceYear || 0,
		status: video.curation?.status,
	}));
}
