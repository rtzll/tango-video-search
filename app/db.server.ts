import { Database } from "bun:sqlite";
import { statSync } from "node:fs";

import { aliasedTable, and, count, countDistinct, desc, eq, exists, gt, ne } from "drizzle-orm";
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
import { ANY_FILTER_VALUE } from "./utils/filters";
import { normalizeName } from "./utils/normalize";

const DEFAULT_DB_PATH = "data/sqlite.db";
const databaseUrl = process.env.DATABASE_URL?.trim();

let dbPath: string;
if (databaseUrl) {
	if (databaseUrl.startsWith("file:")) {
		dbPath = Bun.fileURLToPath(databaseUrl);
	} else {
		dbPath = databaseUrl;
	}
} else {
	dbPath = DEFAULT_DB_PATH;
}

const sqlite = new Database(dbPath, {
	readonly: true,
});
// Configure sqlite
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

function buildOrchestraFilter(orchestra: string) {
	return orchestra === ANY_FILTER_VALUE
		? undefined
		: eq(orchestras.normalized, normalizeName(orchestra));
}

export async function getDancerOptions(otherDancer: string, orchestra: string) {
	if (otherDancer === ANY_FILTER_VALUE) {
		const performanceCount = count(dancersToCurations.curationId);

		return await db
			.select({
				count: performanceCount.as("performanceCount"),
				id: dancers.id,
				name: dancers.name,
			})
			.from(dancers)
			.innerJoin(dancersToCurations, eq(dancers.id, dancersToCurations.dancerId))
			.innerJoin(curations, eq(dancersToCurations.curationId, curations.id))
			.innerJoin(orchestras, eq(curations.orchestraId, orchestras.id))
			.where(buildOrchestraFilter(orchestra))
			.groupBy(dancers.id, dancers.name)
			.having(gt(performanceCount, 0))
			.orderBy(desc(performanceCount));
	}

	const normalizedOtherDancer = normalizeName(otherDancer);
	const dancerOne = aliasedTable(dancers, "d1");
	const dancerTwo = aliasedTable(dancers, "d2");
	const dancerOneCurations = aliasedTable(dancersToCurations, "dc1");
	const dancerTwoCurations = aliasedTable(dancersToCurations, "dc2");
	const performanceCount = countDistinct(dancerOneCurations.curationId);

	return await db
		.select({
			count: performanceCount.as("performanceCount"),
			id: dancerOne.id,
			name: dancerOne.name,
		})
		.from(dancerOne)
		.innerJoin(dancerOneCurations, eq(dancerOne.id, dancerOneCurations.dancerId))
		.innerJoin(dancerTwoCurations, eq(dancerOneCurations.curationId, dancerTwoCurations.curationId))
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
		.where(buildOrchestraFilter(orchestra))
		.groupBy(dancerOne.id, dancerOne.name)
		.having(gt(performanceCount, 0))
		.orderBy(desc(performanceCount));
}

export async function getOrchestraOptions(dancer1: string, dancer2: string) {
	if (dancer1 === ANY_FILTER_VALUE && dancer2 === ANY_FILTER_VALUE) {
		const performanceCount = count(curations.id);

		return db
			.select({
				count: performanceCount.as("performanceCount"),
				id: orchestras.id,
				name: orchestras.name,
			})
			.from(orchestras)
			.leftJoin(curations, eq(orchestras.id, curations.orchestraId))
			.groupBy(orchestras.id, orchestras.name)
			.having(gt(performanceCount, 0))
			.orderBy(desc(performanceCount));
	}

	const performanceCount = countDistinct(curations.id);

	return await db
		.select({
			count: performanceCount.as("performanceCount"),
			id: orchestras.id,
			name: orchestras.name,
		})
		.from(orchestras)
		.innerJoin(curations, eq(orchestras.id, curations.orchestraId))
		.innerJoin(dancersToCurations, eq(curations.id, dancersToCurations.curationId))
		.innerJoin(dancers, eq(dancers.id, dancersToCurations.dancerId))
		.where(buildJoinBasedDancerFilterClause(dancer1, dancer2))
		.groupBy(orchestras.id, orchestras.name)
		.having(gt(performanceCount, 0))
		.orderBy(desc(performanceCount));
}

function curationHasDancer(normalizedDancer: string) {
	const sameCuration = eq(dancersToCurations.curationId, curations.id);
	const sameDancer = eq(dancers.normalized, normalizedDancer);
	const dancerFilter = and(sameCuration, sameDancer);
	const curationQuery = db
		.select({ curationId: dancersToCurations.curationId })
		.from(dancersToCurations)
		.innerJoin(dancers, eq(dancersToCurations.dancerId, dancers.id))
		.where(dancerFilter);

	return exists(curationQuery);
}

function buildDancerFilterClause(dancer1: string, dancer2: string) {
	const dancer1Normalized =
		dancer1 === ANY_FILTER_VALUE ? ANY_FILTER_VALUE : normalizeName(dancer1);
	const dancer2Normalized =
		dancer2 === ANY_FILTER_VALUE ? ANY_FILTER_VALUE : normalizeName(dancer2);

	if (dancer1Normalized !== ANY_FILTER_VALUE && dancer2Normalized !== ANY_FILTER_VALUE) {
		return and(curationHasDancer(dancer1Normalized), curationHasDancer(dancer2Normalized));
	}

	const active = dancer1Normalized !== ANY_FILTER_VALUE ? dancer1Normalized : dancer2Normalized;
	return active === ANY_FILTER_VALUE ? undefined : curationHasDancer(active);
}

function buildJoinBasedDancerFilterClause(dancer1: string, dancer2: string) {
	const dancer1Normalized =
		dancer1 === ANY_FILTER_VALUE ? ANY_FILTER_VALUE : normalizeName(dancer1);
	const dancer2Normalized =
		dancer2 === ANY_FILTER_VALUE ? ANY_FILTER_VALUE : normalizeName(dancer2);

	if (dancer1Normalized !== ANY_FILTER_VALUE && dancer2Normalized !== ANY_FILTER_VALUE) {
		return and(eq(dancers.normalized, dancer1Normalized), curationHasDancer(dancer2Normalized));
	}

	const active = dancer1Normalized !== ANY_FILTER_VALUE ? dancer1Normalized : dancer2Normalized;
	return active === ANY_FILTER_VALUE ? undefined : eq(dancers.normalized, active);
}

function buildWhereClause(dancer1: string, dancer2: string, orchestra: string) {
	return and(buildDancerFilterClause(dancer1, dancer2), buildOrchestraFilter(orchestra));
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
			channelId: videos.channelId,
			channelTitle: videos.channelTitle,
			id: videos.id,
			performance: performances,
			title: videos.title,
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
		channelId: video.channelId,
		channelTitle: video.channelTitle,
		dancers: video.performance?.dancers?.split(",").map((d) => d.trim()) || [],
		id: video.id,
		orchestra: video.performance?.orchestra || "Unknown",
		singers: (video.performance?.singers?.split(",") || []).filter(Boolean),
		songTitle: video.performance?.songTitle || "Unknown",
		title: video.title,
		year: video.performance?.performanceYear || 0,
	}));
}

export async function getFilteredVideosCount(dancer1: string, dancer2: string, orchestra: string) {
	const whereClause = buildWhereClause(dancer1, dancer2, orchestra);

	const results = await db
		.select({
			count: count().as("count"),
		})
		.from(curations)
		.innerJoin(orchestras, eq(curations.orchestraId, orchestras.id))
		.where(whereClause);

	return results[0]?.count ?? 0;
}
