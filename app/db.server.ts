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
import type { SearchFilters, SearchVideo } from "./search";
import { normalizeName } from "./utils/normalize";

export function createDatabase(database: D1Database) {
	return drizzle(database, { schema });
}

type AppDatabase = ReturnType<typeof createDatabase>;

function selectLastDatabaseUpdateTime(db: AppDatabase) {
	return db
		.select({ value: appMetadata.value })
		.from(appMetadata)
		.where(eq(appMetadata.key, "database_updated_at"))
		.limit(1);
}

type DancerFilterKey = "dancer1" | "dancer2";

function withoutFilter(filters: SearchFilters, key: keyof SearchFilters): SearchFilters {
	return { ...filters, [key]: null };
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

function buildDancerFilterClause(db: AppDatabase, dancer1: string | null, dancer2: string | null) {
	const dancer1Normalized = dancer1 === null ? null : normalizeName(dancer1);
	const dancer2Normalized = dancer2 === null ? null : normalizeName(dancer2);

	if (dancer1Normalized !== null && dancer2Normalized !== null) {
		return and(curationHasDancer(db, dancer1Normalized), curationHasDancer(db, dancer2Normalized));
	}

	const active = dancer1Normalized ?? dancer2Normalized;
	return active === null ? undefined : curationHasDancer(db, active);
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

function curationHasChannel(db: AppDatabase, channelId: string) {
	const curationQuery = db
		.select({ id: videos.id })
		.from(performances)
		.innerJoin(videos, eq(performances.videoId, videos.id))
		.where(and(eq(performances.id, curations.performanceId), eq(videos.channelId, channelId)));

	return exists(curationQuery);
}

function curationHasYear(db: AppDatabase, year: string) {
	const parsedYear = Number(year);
	if (!Number.isInteger(parsedYear)) {
		return sql`0`;
	}

	const curationQuery = db
		.select({ id: performances.id })
		.from(performances)
		.where(
			and(
				eq(performances.id, curations.performanceId),
				eq(performances.performanceYear, parsedYear),
			),
		);

	return exists(curationQuery);
}

function buildWhereClause(db: AppDatabase, filters: SearchFilters) {
	return and(
		buildDancerFilterClause(db, filters.dancer1, filters.dancer2),
		filters.channel === null ? undefined : curationHasChannel(db, filters.channel),
		filters.event === null ? undefined : curationHasEvent(db, filters.event.trim()),
		filters.orchestra === null
			? undefined
			: curationHasOrchestra(db, normalizeName(filters.orchestra)),
		filters.song === null ? undefined : curationHasSong(db, normalizeName(filters.song)),
		filters.singer === null ? undefined : curationHasSinger(db, normalizeName(filters.singer)),
		filters.year === null ? undefined : curationHasYear(db, filters.year),
	);
}

function selectEventOptions(db: AppDatabase, filters: SearchFilters) {
	const eventName = sql<string>`trim(${performances.event})`;
	const performanceCount = countDistinct(curations.id);
	const scopedFilters = withoutFilter(filters, "event");
	const scopedWhereClause = buildWhereClause(db, scopedFilters);

	return db
		.select({
			count: performanceCount.as("performanceCount"),
			value: eventName,
		})
		.from(performances)
		.innerJoin(curations, eq(performances.id, curations.performanceId))
		.where(and(scopedWhereClause, sql`${performances.event} is not null`, ne(eventName, "")))
		.groupBy(eventName)
		.having(gt(performanceCount, 0))
		.orderBy(desc(performanceCount));
}

function selectChannelOptions(db: AppDatabase, filters: SearchFilters) {
	const performanceCount = countDistinct(curations.id);

	return db
		.select({
			count: performanceCount.as("performanceCount"),
			label: sql<string>`max(${videos.channelTitle})`,
			value: videos.channelId,
		})
		.from(videos)
		.innerJoin(performances, eq(videos.id, performances.videoId))
		.innerJoin(curations, eq(performances.id, curations.performanceId))
		.where(buildWhereClause(db, withoutFilter(filters, "channel")))
		.groupBy(videos.channelId)
		.having(gt(performanceCount, 0))
		.orderBy(desc(performanceCount));
}

function selectDancerOptions(db: AppDatabase, filters: SearchFilters, filterKey: DancerFilterKey) {
	const otherDancer = filterKey === "dancer1" ? filters.dancer2 : filters.dancer1;
	const performanceCount = countDistinct(curations.id);
	const scopedWhereClause = buildWhereClause(db, withoutFilter(filters, filterKey));
	const otherDancerFilter =
		otherDancer === null ? undefined : ne(dancers.normalized, normalizeName(otherDancer));
	const whereClause = and(scopedWhereClause, otherDancerFilter);

	return db
		.select({
			count: performanceCount.as("performanceCount"),
			value: dancers.name,
		})
		.from(dancers)
		.innerJoin(dancersToCurations, eq(dancers.id, dancersToCurations.dancerId))
		.innerJoin(curations, eq(dancersToCurations.curationId, curations.id))
		.where(whereClause)
		.groupBy(dancers.id, dancers.name)
		.having(gt(performanceCount, 0))
		.orderBy(desc(performanceCount));
}

function selectOrchestraOptions(db: AppDatabase, filters: SearchFilters) {
	const performanceCount = countDistinct(curations.id);

	return db
		.select({
			count: performanceCount.as("performanceCount"),
			value: orchestras.name,
		})
		.from(orchestras)
		.innerJoin(curations, eq(orchestras.id, curations.orchestraId))
		.where(buildWhereClause(db, withoutFilter(filters, "orchestra")))
		.groupBy(orchestras.id, orchestras.name)
		.having(gt(performanceCount, 0))
		.orderBy(desc(performanceCount));
}

function selectSongOptions(db: AppDatabase, filters: SearchFilters) {
	const performanceCount = countDistinct(curations.id);

	return db
		.select({
			count: performanceCount.as("performanceCount"),
			value: songs.title,
		})
		.from(songs)
		.innerJoin(curations, eq(songs.id, curations.songId))
		.where(buildWhereClause(db, withoutFilter(filters, "song")))
		.groupBy(songs.id, songs.title)
		.having(gt(performanceCount, 0))
		.orderBy(desc(performanceCount));
}

function selectSingerOptions(db: AppDatabase, filters: SearchFilters) {
	const performanceCount = countDistinct(curations.id);

	return db
		.select({
			count: performanceCount.as("performanceCount"),
			value: singers.name,
		})
		.from(singers)
		.innerJoin(singersToCurations, eq(singers.id, singersToCurations.singerId))
		.innerJoin(curations, eq(singersToCurations.curationId, curations.id))
		.where(buildWhereClause(db, withoutFilter(filters, "singer")))
		.groupBy(singers.id, singers.name)
		.having(gt(performanceCount, 0))
		.orderBy(desc(performanceCount));
}

function selectYearOptions(db: AppDatabase, filters: SearchFilters) {
	const performanceCount = countDistinct(curations.id);
	const scopedFilters = withoutFilter(filters, "year");
	const scopedWhereClause = buildWhereClause(db, scopedFilters);

	return db
		.select({
			count: performanceCount.as("performanceCount"),
			value: sql<string>`cast(${performances.performanceYear} as text)`,
		})
		.from(performances)
		.innerJoin(curations, eq(performances.id, curations.performanceId))
		.where(and(scopedWhereClause, sql`${performances.performanceYear} is not null`))
		.groupBy(performances.performanceYear)
		.having(gt(performanceCount, 0))
		.orderBy(desc(performances.performanceYear));
}

function selectFilteredVideos(
	db: AppDatabase,
	filters: SearchFilters,
	page: number,
	pageSize: number,
) {
	const whereClause = buildWhereClause(db, filters);
	const offset = (page - 1) * pageSize;

	return db
		.select({
			channelId: videos.channelId,
			channelTitle: videos.channelTitle,
			dancers: performances.dancers,
			event: performances.event,
			id: videos.id,
			orchestra: orchestras.name,
			singers: performances.singers,
			songTitle: sql<string>`${songs.title}`.as("song_title"),
			title: videos.title,
			year: performances.performanceYear,
		})
		.from(curations)
		.innerJoin(performances, eq(curations.performanceId, performances.id))
		.innerJoin(videos, eq(performances.videoId, videos.id))
		.innerJoin(orchestras, eq(curations.orchestraId, orchestras.id))
		.innerJoin(songs, eq(curations.songId, songs.id))
		.where(whereClause)
		.orderBy(desc(performances.performanceYear), desc(videos.publishedAt))
		.limit(pageSize)
		.offset(offset);
}

function searchVideos(rows: Awaited<ReturnType<typeof selectFilteredVideos>>) {
	return rows.map((video) => ({
		channelId: video.channelId,
		channelTitle: video.channelTitle,
		dancers: video.dancers?.split(",").map((d) => d.trim()) || [],
		event: video.event?.trim() || null,
		id: video.id,
		orchestra: video.orchestra,
		singers: (video.singers?.split(",") || []).filter(Boolean),
		songTitle: video.songTitle,
		title: video.title,
		year: video.year ?? null,
	})) satisfies SearchVideo[];
}

function selectFilteredVideosCount(db: AppDatabase, filters: SearchFilters) {
	const whereClause = buildWhereClause(db, filters);

	return db
		.select({
			count: count().as("count"),
		})
		.from(curations)
		.where(whereClause);
}

function namedOptions(rows: readonly { count: number; value: string }[]) {
	return rows.map(({ count, value }) => ({ count, label: value, value }));
}

export async function loadSearchFacets(db: AppDatabase, filters: SearchFilters) {
	const statements = [
		selectChannelOptions(db, filters),
		selectDancerOptions(db, filters, "dancer1"),
		selectEventOptions(db, filters),
		selectOrchestraOptions(db, filters),
		selectSongOptions(db, filters),
		selectSingerOptions(db, filters),
		selectYearOptions(db, filters),
		selectLastDatabaseUpdateTime(db),
	] as const;
	const sharedDancers = filters.dancer1 === null && filters.dancer2 === null;
	const rows = sharedDancers
		? await db.batch(statements)
		: await db.batch([...statements, selectDancerOptions(db, filters, "dancer2")]);
	const [channel, firstDancers, event, orchestra, song, singer, year, metadata, secondDancers] =
		rows;
	const dancer1 = namedOptions(firstDancers);
	const updatedAt = metadata[0]?.value;

	return {
		lastUpdateTime: updatedAt ? new Date(updatedAt) : null,
		options: {
			channel,
			dancer1,
			dancer2: secondDancers === undefined ? dancer1 : namedOptions(secondDancers),
			event: namedOptions(event),
			orchestra: namedOptions(orchestra),
			singer: namedOptions(singer),
			song: namedOptions(song),
			year: namedOptions(year),
		},
	};
}

export async function loadSearchResults(
	db: AppDatabase,
	{ filters, page, pageSize }: { filters: SearchFilters; page: number; pageSize: number },
) {
	const requestedPage = Math.max(1, page);
	// Optimistically read the requested page alongside the count in one D1 call.
	const [counts, requestedRows] = await db.batch([
		selectFilteredVideosCount(db, filters),
		selectFilteredVideos(db, filters, requestedPage, pageSize),
	]);
	const totalVideos = counts[0]?.count ?? 0;
	const totalPages = Math.max(1, Math.ceil(totalVideos / pageSize));
	const safePage = Math.min(requestedPage, totalPages);
	const rows =
		safePage === requestedPage
			? requestedRows
			: await selectFilteredVideos(db, filters, safePage, pageSize);

	return { initialVideos: searchVideos(rows), page: safePage, totalPages, totalVideos };
}
