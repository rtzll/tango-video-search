import { and, count, countDistinct, desc, eq, gt, inArray, ne, sql } from "drizzle-orm";
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
import { filterKeys, type SearchFilters, type SearchVideo } from "./search";
import { decodeCompactFacetOptions } from "./search-page-data";
import { normalizeName } from "./utils/normalize";

export function createDatabase(database: D1Database) {
	// Route read-only queries through the nearest D1 read replica when replication is enabled.
	const client =
		typeof database.withSession === "function"
			? (database.withSession("first-unconstrained") as unknown as D1Database)
			: database;
	return drizzle(client, { schema });
}

type AppDatabase = ReturnType<typeof createDatabase>;

function selectLastDatabaseUpdateTime(db: AppDatabase) {
	return db
		.select({ value: appMetadata.value })
		.from(appMetadata)
		.where(eq(appMetadata.key, "database_updated_at"))
		.limit(1);
}

function selectUnfilteredMetadata(db: AppDatabase) {
	return db
		.select({ key: appMetadata.key, value: appMetadata.value })
		.from(appMetadata)
		.where(inArray(appMetadata.key, ["database_updated_at", "default_facets"]));
}

function hasNoActiveFilters(filters: SearchFilters) {
	return filterKeys.every((key) => filters[key] === null);
}

type DancerFilterKey = "dancer1" | "dancer2";

function withoutFilter(filters: SearchFilters, key: keyof SearchFilters): SearchFilters {
	return { ...filters, [key]: null };
}

function curationHasDancer(db: AppDatabase, normalizedDancer: string) {
	const curationQuery = db
		.select({ curationId: dancersToCurations.curationId })
		.from(dancersToCurations)
		.innerJoin(dancers, eq(dancersToCurations.dancerId, dancers.id))
		.where(eq(dancers.normalized, normalizedDancer));

	return inArray(curations.id, curationQuery);
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
		.where(eq(singers.normalized, normalizedSinger));

	return inArray(curations.id, curationQuery);
}

function curationHasOrchestra(db: AppDatabase, normalizedOrchestra: string) {
	const orchestraQuery = db
		.select({ id: orchestras.id })
		.from(orchestras)
		.where(eq(orchestras.normalized, normalizedOrchestra));

	return inArray(curations.orchestraId, orchestraQuery);
}

function curationHasSong(db: AppDatabase, normalizedSong: string) {
	const songQuery = db
		.select({ id: songs.id })
		.from(songs)
		.where(eq(songs.normalized, normalizedSong));

	return inArray(curations.songId, songQuery);
}

function curationHasEvent(db: AppDatabase, event: string) {
	const performanceQuery = db
		.select({ id: performances.id })
		.from(performances)
		.where(eq(sql`trim(${performances.event})`, event));

	return inArray(curations.performanceId, performanceQuery);
}

function curationHasChannel(db: AppDatabase, channelId: string) {
	const performanceQuery = db
		.select({ id: performances.id })
		.from(performances)
		.innerJoin(videos, eq(performances.videoId, videos.id))
		.where(eq(videos.channelId, channelId));

	return inArray(curations.performanceId, performanceQuery);
}

function curationHasYear(db: AppDatabase, year: string) {
	const parsedYear = Number(year);
	if (!Number.isInteger(parsedYear)) {
		return sql`0`;
	}

	const performanceQuery = db
		.select({ id: performances.id })
		.from(performances)
		.where(eq(performances.performanceYear, parsedYear));

	return inArray(curations.performanceId, performanceQuery);
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
	if (hasNoActiveFilters(filters)) {
		const metadataRows = await selectUnfilteredMetadata(db);
		const byKey = new Map(metadataRows.map((row) => [row.key, row.value]));
		const precomputed = byKey.get("default_facets");
		if (precomputed) {
			try {
				const decoded = decodeCompactFacetOptions(JSON.parse(precomputed));
				const options = { ...decoded, dancer2: decoded.dancer1 };
				const updatedAt = byKey.get("database_updated_at");
				return {
					lastUpdateTime: updatedAt ? new Date(updatedAt) : null,
					options,
				};
			} catch {
				// Fall back to live facet aggregation if precomputed metadata is malformed.
			}
		}
	}

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
