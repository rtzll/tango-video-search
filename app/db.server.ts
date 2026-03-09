import { Database } from "bun:sqlite";
import { statSync } from "node:fs";
import { aliasedTable, and, desc, eq, exists, ne, sql } from "drizzle-orm";
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

const DEFAULT_DB_PATH = "data/sqlite.db";
const databaseUrl = process.env.DATABASE_URL?.trim();
const dbPath = databaseUrl
	? databaseUrl.startsWith("file:")
		? Bun.fileURLToPath(databaseUrl)
		: databaseUrl
	: DEFAULT_DB_PATH;
const sqlite = new Database(dbPath, {
	readonly: true,
});
// configure sqlite
sqlite.query("pragma synchronous = normal;").run();
sqlite.query("pragma busy_timeout = 5000;").run();
sqlite.query("pragma cache_size = 500;").run();
sqlite.query("pragma temp_store = file;").run();
sqlite.query("pragma mmap_size = 67108864;").run();
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
			.innerJoin(
				dancersToCurations,
				eq(dancers.id, dancersToCurations.dancerId),
			)
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
	const dancerOne = aliasedTable(dancers, "d1");
	const dancerTwo = aliasedTable(dancers, "d2");
	const dancerOneCurations = aliasedTable(dancersToCurations, "dc1");
	const dancerTwoCurations = aliasedTable(dancersToCurations, "dc2");

	return await db
		.select({
			id: dancerOne.id,
			name: dancerOne.name,
			count: sql<number>`count(DISTINCT ${dancerOneCurations.curationId})`.as(
				"performanceCount",
			),
		})
		.from(dancerOne)
		.innerJoin(dancerOneCurations, eq(dancerOne.id, dancerOneCurations.dancerId))
		.innerJoin(
			dancerTwoCurations,
			eq(dancerOneCurations.curationId, dancerTwoCurations.curationId),
		)
		.innerJoin(
			dancerTwo,
			and(
				eq(dancerTwo.id, dancerTwoCurations.dancerId),
				eq(dancerTwo.normalized, normalizedOtherDancer),
				ne(dancerTwo.id, dancerOne.id),
			),
		)
		.innerJoin(curations, eq(dancerOneCurations.curationId, curations.id))
		.innerJoin(orchestras, eq(curations.orchestraId, orchestras.id))
		.where(
			orchestra === "any"
				? sql`1`
				: eq(orchestras.normalized, normalizedOrchestra),
		)
		.groupBy(dancerOne.id, dancerOne.name)
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
		.where(
			dancer1 === "any" && dancer2 === "any"
				? sql`1`
				: buildJoinBasedDancerFilterClause(dancer1, dancer2),
		)
		.groupBy(orchestras.id, orchestras.name)
		.having(sql`performanceCount > 0`)
		.orderBy(sql`performanceCount DESC`);
}

function curationHasDancer(normalizedDancer: string) {
	return exists(
		db
			.select({ curationId: dancersToCurations.curationId })
			.from(dancersToCurations)
			.innerJoin(dancers, eq(dancersToCurations.dancerId, dancers.id))
			.where(
				and(
					eq(dancersToCurations.curationId, curations.id),
					eq(dancers.normalized, normalizedDancer),
				),
			),
	);
}

function buildDancerFilterClause(dancer1: string, dancer2: string) {
	const dancer1Normalized = dancer1 === "any" ? "any" : normalizeName(dancer1);
	const dancer2Normalized = dancer2 === "any" ? "any" : normalizeName(dancer2);

	if (dancer1Normalized !== "any" && dancer2Normalized !== "any") {
		return sql`${curationHasDancer(dancer1Normalized)} AND ${curationHasDancer(
			dancer2Normalized,
		)}`;
	}

	const active =
		dancer1Normalized !== "any" ? dancer1Normalized : dancer2Normalized;
	return active === "any" ? sql`1` : curationHasDancer(active);
}

function buildJoinBasedDancerFilterClause(dancer1: string, dancer2: string) {
	const dancer1Normalized = dancer1 === "any" ? "any" : normalizeName(dancer1);
	const dancer2Normalized = dancer2 === "any" ? "any" : normalizeName(dancer2);

	if (dancer1Normalized !== "any" && dancer2Normalized !== "any") {
		return and(
			eq(dancers.normalized, dancer1Normalized),
			curationHasDancer(dancer2Normalized),
		);
	}

	const active =
		dancer1Normalized !== "any" ? dancer1Normalized : dancer2Normalized;
	return sql`${dancers.normalized} = ${active}`;
}

function buildWhereClause(dancer1: string, dancer2: string, orchestra: string) {
	return (
		and(
			buildDancerFilterClause(dancer1, dancer2),
			orchestra === "any"
				? undefined
				: eq(orchestras.normalized, normalizeName(orchestra)),
		) ?? sql`1`
	);
}

export async function getFilteredVideos(
	dancer1: string,
	dancer2: string,
	orchestra: string,
	page: number,
	pageSize: number,
) {
	const whereClause = buildWhereClause(dancer1, dancer2, orchestra);
	const offset = (page - 1) * pageSize;

	const results = await db
		.select({
			id: videos.id,
			title: videos.title,
			channelTitle: videos.channelTitle,
			channelId: videos.channelId,
			performance: performances,
		})
		.from(curations)
		.innerJoin(performances, eq(curations.performanceId, performances.id))
		.innerJoin(videos, eq(performances.videoId, videos.id))
		.innerJoin(orchestras, eq(curations.orchestraId, orchestras.id))
		.where(whereClause)
		.orderBy(desc(performances.performanceYear), desc(videos.publishedAt))
		.limit(pageSize)
		.offset(offset);

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
	}));
}

export async function getFilteredVideosCount(
	dancer1: string,
	dancer2: string,
	orchestra: string,
) {
	const whereClause = buildWhereClause(dancer1, dancer2, orchestra);

	const results = await db
		.select({
			count: sql<number>`count(*)`.as("count"),
		})
		.from(curations)
		.innerJoin(orchestras, eq(curations.orchestraId, orchestras.id))
		.where(whereClause);

	return results[0]?.count ?? 0;
}
