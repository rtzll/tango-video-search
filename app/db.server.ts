import { and, count, countDistinct, desc, eq, exists, gt, ne, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";

import * as schema from "../schema";
import {
	appMetadata,
	curations,
	dancers,
	dancersToCurations,
	orchestras,
	performances,
	singers,
	singersToCurations,
	songs,
	videos,
} from "../schema";
import type { SearchFilters } from "./search";
import { ANY_FILTER_VALUE } from "./utils/filters";
import { normalizeName } from "./utils/normalize";

export function createDatabase(database: D1Database) {
	return drizzle(database, { schema });
}

type AppDatabase = ReturnType<typeof createDatabase>;

async function getLastDatabaseUpdateTime(db: AppDatabase) {
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

type DancerFilterKey = "dancer1" | "dancer2";

function withoutFilter(filters: SearchFilters, key: keyof SearchFilters): SearchFilters {
	return { ...filters, [key]: ANY_FILTER_VALUE };
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

function curationHasSinger(db: AppDatabase, normalizedSinger: string) {
	const curationQuery = db
		.select({ curationId: singersToCurations.curationId })
		.from(singersToCurations)
		.innerJoin(singers, eq(singersToCurations.singerId, singers.id))
		.where(
			and(
				eq(singersToCurations.curationId, curations.id),
				eq(singers.normalized, normalizedSinger),
			),
		);

	return exists(curationQuery);
}

function curationHasOrchestra(db: AppDatabase, normalizedOrchestra: string) {
	const sameCuration = eq(orchestras.id, curations.orchestraId);
	const sameOrchestra = eq(orchestras.normalized, normalizedOrchestra);
	const curationQuery = db
		.select({ id: orchestras.id })
		.from(orchestras)
		.where(and(sameCuration, sameOrchestra));

	return exists(curationQuery);
}

function curationHasSong(db: AppDatabase, normalizedSong: string) {
	const sameCuration = eq(songs.id, curations.songId);
	const sameSong = eq(songs.normalized, normalizedSong);
	const curationQuery = db.select({ id: songs.id }).from(songs).where(and(sameCuration, sameSong));

	return exists(curationQuery);
}

function curationHasEvent(db: AppDatabase, event: string) {
	const curationQuery = db
		.select({ id: performances.id })
		.from(performances)
		.where(
			and(
				eq(performances.id, curations.performanceId),
				eq(sql`trim(${performances.event})`, event),
			),
		);

	return exists(curationQuery);
}

function buildWhereClause(db: AppDatabase, filters: SearchFilters) {
	return and(
		buildDancerFilterClause(db, filters.dancer1, filters.dancer2),
		filters.event === ANY_FILTER_VALUE ? undefined : curationHasEvent(db, filters.event.trim()),
		filters.orchestra === ANY_FILTER_VALUE
			? undefined
			: curationHasOrchestra(db, normalizeName(filters.orchestra)),
		filters.song === ANY_FILTER_VALUE
			? undefined
			: curationHasSong(db, normalizeName(filters.song)),
		filters.singer === ANY_FILTER_VALUE
			? undefined
			: curationHasSinger(db, normalizeName(filters.singer)),
	);
}

async function getEventOptions(db: AppDatabase, filters: SearchFilters) {
	const eventName = sql<string>`trim(${performances.event})`;
	const performanceCount = countDistinct(curations.id);
	const scopedFilters = withoutFilter(filters, "event");
	const scopedWhereClause = buildWhereClause(db, scopedFilters);

	return db
		.select({
			count: performanceCount.as("performanceCount"),
			id: sql<number>`min(${curations.id})`,
			name: eventName,
		})
		.from(performances)
		.innerJoin(curations, eq(performances.id, curations.performanceId))
		.where(and(scopedWhereClause, sql`${performances.event} is not null`, ne(eventName, "")))
		.groupBy(eventName)
		.having(gt(performanceCount, 0))
		.orderBy(desc(performanceCount));
}

async function getDancerOptions(
	db: AppDatabase,
	filters: SearchFilters,
	filterKey: DancerFilterKey,
) {
	const otherDancer = filterKey === "dancer1" ? filters.dancer2 : filters.dancer1;
	const performanceCount = countDistinct(curations.id);
	const scopedWhereClause = buildWhereClause(db, withoutFilter(filters, filterKey));
	const otherDancerFilter =
		otherDancer === ANY_FILTER_VALUE
			? undefined
			: ne(dancers.normalized, normalizeName(otherDancer));
	const whereClause = and(scopedWhereClause, otherDancerFilter);

	return db
		.select({
			count: performanceCount.as("performanceCount"),
			id: dancers.id,
			name: dancers.name,
		})
		.from(dancers)
		.innerJoin(dancersToCurations, eq(dancers.id, dancersToCurations.dancerId))
		.innerJoin(curations, eq(dancersToCurations.curationId, curations.id))
		.where(whereClause)
		.groupBy(dancers.id, dancers.name)
		.having(gt(performanceCount, 0))
		.orderBy(desc(performanceCount));
}

async function getOrchestraOptions(db: AppDatabase, filters: SearchFilters) {
	const performanceCount = countDistinct(curations.id);

	return db
		.select({
			count: performanceCount.as("performanceCount"),
			id: orchestras.id,
			name: orchestras.name,
		})
		.from(orchestras)
		.innerJoin(curations, eq(orchestras.id, curations.orchestraId))
		.where(buildWhereClause(db, withoutFilter(filters, "orchestra")))
		.groupBy(orchestras.id, orchestras.name)
		.having(gt(performanceCount, 0))
		.orderBy(desc(performanceCount));
}

async function getSongOptions(db: AppDatabase, filters: SearchFilters) {
	const performanceCount = countDistinct(curations.id);

	return db
		.select({
			count: performanceCount.as("performanceCount"),
			id: songs.id,
			name: songs.title,
		})
		.from(songs)
		.innerJoin(curations, eq(songs.id, curations.songId))
		.where(buildWhereClause(db, withoutFilter(filters, "song")))
		.groupBy(songs.id, songs.title)
		.having(gt(performanceCount, 0))
		.orderBy(desc(performanceCount));
}

async function getSingerOptions(db: AppDatabase, filters: SearchFilters) {
	const performanceCount = countDistinct(curations.id);

	return db
		.select({
			count: performanceCount.as("performanceCount"),
			id: singers.id,
			name: singers.name,
		})
		.from(singers)
		.innerJoin(singersToCurations, eq(singers.id, singersToCurations.singerId))
		.innerJoin(curations, eq(singersToCurations.curationId, curations.id))
		.where(buildWhereClause(db, withoutFilter(filters, "singer")))
		.groupBy(singers.id, singers.name)
		.having(gt(performanceCount, 0))
		.orderBy(desc(performanceCount));
}

async function getFilteredVideos(
	db: AppDatabase,
	filters: SearchFilters,
	page: number,
	pageSize: number,
) {
	const whereClause = buildWhereClause(db, filters);
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
		.where(whereClause)
		.orderBy(desc(performances.performanceYear), desc(videos.publishedAt))
		.limit(pageSize)
		.offset(offset);

	return results.map((video) => ({
		channelId: video.channelId,
		channelTitle: video.channelTitle,
		dancers: video.performance?.dancers?.split(",").map((d) => d.trim()) || [],
		event: video.performance?.event?.trim() || null,
		id: video.id,
		orchestra: video.performance?.orchestra || "Unknown",
		singers: (video.performance?.singers?.split(",") || []).filter(Boolean),
		songTitle: video.performance?.songTitle || "Unknown",
		title: video.title,
		year: video.performance?.performanceYear ?? null,
	}));
}

async function getFilteredVideosCount(db: AppDatabase, filters: SearchFilters) {
	const whereClause = buildWhereClause(db, filters);

	const results = await db
		.select({
			count: count().as("count"),
		})
		.from(curations)
		.where(whereClause);

	return results[0]?.count ?? 0;
}

export async function loadSearchPage(
	db: AppDatabase,
	{
		filters,
		page,
		pageSize,
	}: {
		filters: SearchFilters;
		page: number;
		pageSize: number;
	},
) {
	const [
		dancerOneOptions,
		dancerTwoOptions,
		eventOptions,
		orchestraOptions,
		songOptions,
		singerOptions,
		totalVideos,
		lastUpdateTime,
	] = await Promise.all([
		getDancerOptions(db, filters, "dancer1"),
		getDancerOptions(db, filters, "dancer2"),
		getEventOptions(db, filters),
		getOrchestraOptions(db, filters),
		getSongOptions(db, filters),
		getSingerOptions(db, filters),
		getFilteredVideosCount(db, filters),
		getLastDatabaseUpdateTime(db),
	]);
	const totalPages = Math.max(1, Math.ceil(totalVideos / pageSize));
	const safePage = Math.min(page, totalPages);
	const initialVideos = await getFilteredVideos(db, filters, safePage, pageSize);

	return {
		dancerOneOptions,
		dancerTwoOptions,
		eventOptions,
		initialVideos,
		lastUpdateTime,
		orchestraOptions,
		page: safePage,
		singerOptions,
		songOptions,
		totalPages,
		totalVideos,
	};
}
