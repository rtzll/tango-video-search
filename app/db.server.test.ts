import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";

import { createDatabase, loadSearchPage } from "./db.server";
import { ANY_FILTER_VALUE } from "./utils/filters";

const database = (env as unknown as { DB: D1Database }).DB;
const emptyFilters = {
	dancer1: ANY_FILTER_VALUE,
	dancer2: ANY_FILTER_VALUE,
	event: ANY_FILTER_VALUE,
	orchestra: ANY_FILTER_VALUE,
	singer: ANY_FILTER_VALUE,
	song: ANY_FILTER_VALUE,
	year: ANY_FILTER_VALUE,
};

async function executeStatements(sql: string) {
	const statements = sql
		.split(";")
		.map((statement) => statement.trim())
		.filter(Boolean)
		.map((statement) => database.prepare(statement));
	await database.batch(statements);
}

beforeEach(async () => {
	await executeStatements(`
		DROP TABLE IF EXISTS singers_to_curations;
		DROP TABLE IF EXISTS dancers_to_curations;
		DROP TABLE IF EXISTS curations;
		DROP TABLE IF EXISTS singers;
		DROP TABLE IF EXISTS dancers;
		DROP TABLE IF EXISTS songs;
		DROP TABLE IF EXISTS orchestras;
		DROP TABLE IF EXISTS performances;
		DROP TABLE IF EXISTS videos;
		DROP TABLE IF EXISTS app_metadata;

		CREATE TABLE app_metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL);
		CREATE TABLE videos (
			id TEXT PRIMARY KEY,
			channel_id TEXT NOT NULL,
			channel_title TEXT NOT NULL,
			title TEXT NOT NULL,
			published_at TEXT NOT NULL
		);
		CREATE TABLE performances (
			id TEXT PRIMARY KEY,
			video_id TEXT NOT NULL,
			dancers TEXT,
			event TEXT,
			orchestra TEXT,
			performance_year INTEGER,
			singers TEXT,
			song_title TEXT
		);
		CREATE TABLE orchestras (
			id INTEGER PRIMARY KEY,
			name TEXT NOT NULL,
			normalized TEXT NOT NULL UNIQUE
		);
		CREATE TABLE songs (
			id INTEGER PRIMARY KEY,
			title TEXT NOT NULL,
			normalized TEXT NOT NULL UNIQUE
		);
		CREATE TABLE dancers (
			id INTEGER PRIMARY KEY,
			name TEXT NOT NULL,
			normalized TEXT NOT NULL UNIQUE
		);
		CREATE TABLE singers (
			id INTEGER PRIMARY KEY,
			name TEXT NOT NULL,
			normalized TEXT NOT NULL UNIQUE
		);
		CREATE TABLE curations (
			id INTEGER PRIMARY KEY,
			performance_id TEXT NOT NULL,
			orchestra_id INTEGER NOT NULL,
			song_id INTEGER NOT NULL
		);
		CREATE TABLE dancers_to_curations (curation_id INTEGER, dancer_id INTEGER);
		CREATE TABLE singers_to_curations (curation_id INTEGER, singer_id INTEGER);

		INSERT INTO app_metadata VALUES ('database_updated_at', '2026-07-11T00:00:00.000Z');
		INSERT INTO orchestras VALUES (1, 'Orchestra One', 'orchestra one'), (2, 'Orchestra Two', 'orchestra two');
		INSERT INTO songs VALUES (1, 'Song One', 'song one'), (2, 'Song Two', 'song two');
		INSERT INTO dancers VALUES (1, 'Alice', 'alice'), (2, 'Bob', 'bob'), (3, 'Carol', 'carol');
		INSERT INTO singers VALUES (1, 'Singer One', 'singer one'), (2, 'Singer Two', 'singer two');
		INSERT INTO videos VALUES
			('video-1', 'channel-1', 'Channel One', 'Video One', '2024-01-01'),
			('video-2', 'channel-1', 'Channel One', 'Video Two', '2023-01-01'),
			('video-3', 'channel-2', 'Channel Two', 'Video Three', '2022-01-01');
		INSERT INTO performances VALUES
			('performance-1', 'video-1', 'Alice, Bob', 'Event One', 'Orchestra One', 2024, 'Singer One', 'Song One'),
			('performance-2', 'video-2', 'Alice, Carol', 'Event Two', 'Orchestra One', 2023, '', 'Song Two'),
			('performance-3', 'video-3', 'Bob, Carol', NULL, 'Orchestra Two', 2022, 'Singer Two', 'Song One');
		INSERT INTO curations VALUES
			(1, 'performance-1', 1, 1),
			(2, 'performance-2', 1, 2),
			(3, 'performance-3', 2, 1);
		INSERT INTO dancers_to_curations VALUES (1, 1), (1, 2), (2, 1), (2, 3), (3, 2), (3, 3);
		INSERT INTO singers_to_curations VALUES (1, 1), (3, 2);
	`);
});

describe("loadSearchPage", () => {
	it("returns the first page and every available filter option", async () => {
		const result = await loadSearchPage(createDatabase(database), {
			filters: emptyFilters,
			page: 1,
			pageSize: 2,
		});

		expect(result.totalVideos).toBe(3);
		expect(result.totalPages).toBe(2);
		expect(result.page).toBe(1);
		expect(result.initialVideos.map((video) => video.id)).toEqual(["video-1", "video-2"]);
		expect(result.options.dancer1).toEqual([
			{ count: 2, id: 1, name: "Alice" },
			{ count: 2, id: 2, name: "Bob" },
			{ count: 2, id: 3, name: "Carol" },
		]);
		expect(result.options.orchestra).toEqual([
			{ count: 2, id: 1, name: "Orchestra One" },
			{ count: 1, id: 2, name: "Orchestra Two" },
		]);
		expect(
			result.options.event
				.map(({ count, name }) => ({ count, name }))
				.toSorted((left, right) => left.name.localeCompare(right.name)),
		).toEqual([
			{ count: 1, name: "Event One" },
			{ count: 1, name: "Event Two" },
		]);
		expect(result.options.singer).toEqual([
			{ count: 1, id: 1, name: "Singer One" },
			{ count: 1, id: 2, name: "Singer Two" },
		]);
		expect(result.options.song).toEqual([
			{ count: 2, id: 1, name: "Song One" },
			{ count: 1, id: 2, name: "Song Two" },
		]);
		expect(result.options.year).toEqual([
			{ count: 1, id: 2024, name: "2024" },
			{ count: 1, id: 2023, name: "2023" },
			{ count: 1, id: 2022, name: "2022" },
		]);
		expect(result.lastUpdateTime).toEqual(new Date("2026-07-11T00:00:00.000Z"));
	});

	it("scopes every option list to the other active filters", async () => {
		const result = await loadSearchPage(createDatabase(database), {
			filters: { ...emptyFilters, dancer1: "Alice" },
			page: 1,
			pageSize: 18,
		});

		expect(result.totalVideos).toBe(2);
		expect(result.initialVideos.map((video) => video.id)).toEqual(["video-1", "video-2"]);
		expect(result.options.dancer2).toEqual([
			{ count: 1, id: 2, name: "Bob" },
			{ count: 1, id: 3, name: "Carol" },
		]);
		expect(result.options.orchestra).toEqual([{ count: 2, id: 1, name: "Orchestra One" }]);
		expect(result.options.event.map(({ count, name }) => ({ count, name }))).toEqual(
			expect.arrayContaining([
				{ count: 1, name: "Event One" },
				{ count: 1, name: "Event Two" },
			]),
		);
		expect(result.options.singer).toEqual([{ count: 1, id: 1, name: "Singer One" }]);
		expect(result.options.song).toEqual([
			{ count: 1, id: 1, name: "Song One" },
			{ count: 1, id: 2, name: "Song Two" },
		]);
		expect(result.options.year).toEqual([
			{ count: 1, id: 2024, name: "2024" },
			{ count: 1, id: 2023, name: "2023" },
		]);
	});

	it("filters performances by year and scopes the other option lists", async () => {
		const result = await loadSearchPage(createDatabase(database), {
			filters: { ...emptyFilters, year: "2024" },
			page: 1,
			pageSize: 18,
		});

		expect(result.totalVideos).toBe(1);
		expect(result.initialVideos.map((video) => video.id)).toEqual(["video-1"]);
		expect(result.options.event.map(({ count, name }) => ({ count, name }))).toEqual([
			{ count: 1, name: "Event One" },
		]);
		expect(result.options.year).toEqual([
			{ count: 1, id: 2024, name: "2024" },
			{ count: 1, id: 2023, name: "2023" },
			{ count: 1, id: 2022, name: "2022" },
		]);
	});

	it("clamps a page past the end to the final page", async () => {
		const result = await loadSearchPage(createDatabase(database), {
			filters: emptyFilters,
			page: 99,
			pageSize: 2,
		});

		expect(result.page).toBe(2);
		expect(result.initialVideos.map((video) => video.id)).toEqual(["video-3"]);
	});

	it("clamps a page below the beginning to the first page", async () => {
		const result = await loadSearchPage(createDatabase(database), {
			filters: emptyFilters,
			page: 0,
			pageSize: 2,
		});

		expect(result.page).toBe(1);
		expect(result.initialVideos.map((video) => video.id)).toEqual(["video-1", "video-2"]);
	});
});
