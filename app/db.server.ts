import { aliasedTable, and, count, countDistinct, desc, eq, exists, gt, ne } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";

import * as schema from "../schema";
import {
	appMetadata,
	curations,
	dancers,
	dancersToCurations,
	orchestras,
	performances,
	videos,
} from "../schema";
import { ANY_FILTER_VALUE } from "./utils/filters";
import { normalizeName } from "./utils/normalize";

export function createDatabase(database: D1Database) {
	return drizzle(database, { schema });
}

type AppDatabase = ReturnType<typeof createDatabase>;

export async function getLastDatabaseUpdateTime(db: AppDatabase) {
	try {
		const results = await db
			.select({ value: appMetadata.value })
			.from(appMetadata)
			.where(eq(appMetadata.key, "database_updated_at"))
			.limit(1);
		const value = results[0]?.value;
		return value ? new Date(value) : null;
	} catch (error) {
		console.error("Error getting database update metadata:", error);
		return null;
	}
}

function buildOrchestraFilter(orchestra: string) {
	return orchestra === ANY_FILTER_VALUE
		? undefined
		: eq(orchestras.normalized, normalizeName(orchestra));
}

export async function getDancerOptions(db: AppDatabase, otherDancer: string, orchestra: string) {
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

export async function getOrchestraOptions(db: AppDatabase, dancer1: string, dancer2: string) {
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
		.where(buildJoinBasedDancerFilterClause(db, dancer1, dancer2))
		.groupBy(orchestras.id, orchestras.name)
		.having(gt(performanceCount, 0))
		.orderBy(desc(performanceCount));
}

function curationHasDancer(db: AppDatabase, normalizedDancer: string) {
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

function buildDancerFilterClause(db: AppDatabase, dancer1: string, dancer2: string) {
	const dancer1Normalized =
		dancer1 === ANY_FILTER_VALUE ? ANY_FILTER_VALUE : normalizeName(dancer1);
	const dancer2Normalized =
		dancer2 === ANY_FILTER_VALUE ? ANY_FILTER_VALUE : normalizeName(dancer2);

	if (dancer1Normalized !== ANY_FILTER_VALUE && dancer2Normalized !== ANY_FILTER_VALUE) {
		return and(curationHasDancer(db, dancer1Normalized), curationHasDancer(db, dancer2Normalized));
	}

	const active = dancer1Normalized !== ANY_FILTER_VALUE ? dancer1Normalized : dancer2Normalized;
	return active === ANY_FILTER_VALUE ? undefined : curationHasDancer(db, active);
}

function buildJoinBasedDancerFilterClause(db: AppDatabase, dancer1: string, dancer2: string) {
	const dancer1Normalized =
		dancer1 === ANY_FILTER_VALUE ? ANY_FILTER_VALUE : normalizeName(dancer1);
	const dancer2Normalized =
		dancer2 === ANY_FILTER_VALUE ? ANY_FILTER_VALUE : normalizeName(dancer2);

	if (dancer1Normalized !== ANY_FILTER_VALUE && dancer2Normalized !== ANY_FILTER_VALUE) {
		return and(eq(dancers.normalized, dancer1Normalized), curationHasDancer(db, dancer2Normalized));
	}

	const active = dancer1Normalized !== ANY_FILTER_VALUE ? dancer1Normalized : dancer2Normalized;
	return active === ANY_FILTER_VALUE ? undefined : eq(dancers.normalized, active);
}

function buildWhereClause(db: AppDatabase, dancer1: string, dancer2: string, orchestra: string) {
	return and(buildDancerFilterClause(db, dancer1, dancer2), buildOrchestraFilter(orchestra));
}

export async function getFilteredVideos(
	db: AppDatabase,
	dancer1: string,
	dancer2: string,
	orchestra: string,
	page: number,
	pageSize: number,
) {
	const whereClause = buildWhereClause(db, dancer1, dancer2, orchestra);
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

export async function getFilteredVideosCount(
	db: AppDatabase,
	dancer1: string,
	dancer2: string,
	orchestra: string,
) {
	const whereClause = buildWhereClause(db, dancer1, dancer2, orchestra);

	const results = await db
		.select({
			count: count().as("count"),
		})
		.from(curations)
		.innerJoin(orchestras, eq(curations.orchestraId, orchestras.id))
		.where(whereClause);

	return results[0]?.count ?? 0;
}
