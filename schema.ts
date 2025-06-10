import { type InferInsertModel, relations } from "drizzle-orm";
import {
	integer,
	primaryKey,
	sqliteTable,
	text,
} from "drizzle-orm/sqlite-core";

export const videos = sqliteTable("videos", {
	id: text("id").primaryKey(),
	title: text("title").notNull(),
	description: text("description").notNull(),
	publishedAt: text("published_at").notNull(),
	tags: text("tags").notNull(),
	channelName: text("channel_name").notNull(),
	channelTitle: text("channel_title").notNull(),
	channelId: text("channel_id").notNull(),
	duration: integer("duration").notNull(),
	viewCount: integer("view_count").notNull(),
	likeCount: integer("like_count").notNull(),
	commentCount: integer("comment_count").notNull(),
});
export type Video = InferInsertModel<typeof videos>;

export const videoRelations = relations(videos, ({ one }) => ({
	performance: one(performances, {
		fields: [videos.id],
		references: [performances.videoId],
	}),
}));

export const performances = sqliteTable("performances", {
	id: text("id").primaryKey(),
	dancers: text("dancers"),
	songTitle: text("song_title"),
	orchestra: text("orchestra"),
	singers: text("singers"),
	performanceYear: integer("performance_year"),
	videoId: text("video_id")
		.notNull()
		.references(() => videos.id, { onDelete: "cascade" }),
});
export type Performance = InferInsertModel<typeof performances>;

export const performanceRelations = relations(performances, ({ one }) => ({
	video: one(videos, {
		fields: [performances.videoId],
		references: [videos.id],
	}),
}));

export const orchestras = sqliteTable("orchestras", {
	id: integer("id").primaryKey({ autoIncrement: true }),
	name: text("name").notNull(),
	normalized: text("normalized").notNull().unique(),
});
export type Orchestra = InferInsertModel<typeof orchestras>;

export const singers = sqliteTable("singers", {
	id: integer("id").primaryKey({ autoIncrement: true }),
	name: text("name").notNull(),
	normalized: text("normalized").notNull().unique(),
});
export type Singer = InferInsertModel<typeof singers>;

export const songs = sqliteTable("songs", {
	id: integer("id").primaryKey({ autoIncrement: true }),
	title: text("title").notNull(),
	normalized: text("normalized").notNull().unique(),
});

export const dancers = sqliteTable("dancers", {
	id: integer("id").primaryKey({ autoIncrement: true }),
	name: text("name").notNull(),
	normalized: text("normalized").notNull().unique(),
});
export type Dancer = InferInsertModel<typeof dancers>;

export const CurationStatus = {
	autoProcessed: "auto_processed",
	inReview: "in_review",
	needsCorrection: "needs_correction",
	verified: "verified",
	rejected: "rejected",
} as const;

type CurationStatusType = (typeof CurationStatus)[keyof typeof CurationStatus];
const curationStatusValues = Object.values(CurationStatus) as [
	CurationStatusType,
	...CurationStatusType[],
];

export const curations = sqliteTable("curations", {
	id: integer("id").primaryKey({ autoIncrement: true }),
	performanceId: text("performance_id")
		.notNull()
		.references(() => performances.id, { onDelete: "cascade" }),
	songId: integer("song_id")
		.notNull()
		.references(() => songs.id),
	orchestraId: integer("orchestra_id")
		.notNull()
		.references(() => orchestras.id),
	status: text("status", { enum: curationStatusValues })
		.notNull()
		.default(CurationStatus.autoProcessed),
	notes: text("notes"),
});
export type Curation = InferInsertModel<typeof curations>;

export const dancersToCurations = sqliteTable(
	"dancers_to_curations",
	{
		curationId: integer("curation_id")
			.notNull()
			.references(() => curations.id, { onDelete: "cascade" }),
		dancerId: integer("dancer_id")
			.notNull()
			.references(() => dancers.id, { onDelete: "cascade" }),
	},
	(table) => {
		return {
			pk: primaryKey({ columns: [table.curationId, table.dancerId] }),
		};
	},
);

export const singersToCurations = sqliteTable(
	"singers_to_curations",
	{
		curationId: integer("curation_id")
			.notNull()
			.references(() => curations.id, { onDelete: "cascade" }),
		singerId: integer("singer_id")
			.notNull()
			.references(() => singers.id, { onDelete: "cascade" }),
	},
	(table) => {
		return {
			pk: primaryKey({ columns: [table.curationId, table.singerId] }),
		};
	},
);

export const curationsRelations = relations(curations, ({ many, one }) => ({
	curationDancers: many(dancersToCurations),
	curationSingers: many(singersToCurations),
	performance: one(performances, {
		fields: [curations.performanceId],
		references: [performances.id],
	}),
	song: one(songs, {
		fields: [curations.songId],
		references: [songs.id],
	}),
	orchestra: one(orchestras, {
		fields: [curations.orchestraId],
		references: [orchestras.id],
	}),
}));

export const dancersRelations = relations(dancers, ({ many }) => ({
	curationDancers: many(dancersToCurations),
}));

export const curationDancersRelations = relations(
	dancersToCurations,
	({ one }) => ({
		curation: one(curations, {
			fields: [dancersToCurations.curationId],
			references: [curations.id],
		}),
		dancer: one(dancers, {
			fields: [dancersToCurations.dancerId],
			references: [dancers.id],
		}),
	}),
);
