import { type InferInsertModel, relations } from "drizzle-orm";
import { integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const videos = sqliteTable("videos", {
	channelId: text("channel_id").notNull(),
	channelName: text("channel_name").notNull(),
	channelTitle: text("channel_title").notNull(),
	commentCount: integer("comment_count").notNull(),
	description: text("description").notNull(),
	duration: integer("duration").notNull(),
	id: text("id").primaryKey(),
	likeCount: integer("like_count").notNull(),
	publishedAt: text("published_at").notNull(),
	tags: text("tags").notNull(),
	title: text("title").notNull(),
	viewCount: integer("view_count").notNull(),
});
export type Video = InferInsertModel<typeof videos>;

export const videoRelations = relations(videos, ({ one }) => ({
	performance: one(performances, {
		fields: [videos.id],
		references: [performances.videoId],
	}),
}));

export const performances = sqliteTable("performances", {
	dancers: text("dancers"),
	id: text("id").primaryKey(),
	orchestra: text("orchestra"),
	performanceYear: integer("performance_year"),
	singers: text("singers"),
	songTitle: text("song_title"),
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
	normalized: text("normalized").notNull().unique(),
	title: text("title").notNull(),
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
	rejected: "rejected",
	verified: "verified",
} as const;

type CurationStatusType = (typeof CurationStatus)[keyof typeof CurationStatus];
const curationStatusValues = Object.values(CurationStatus) as [
	CurationStatusType,
	...CurationStatusType[],
];

export const curations = sqliteTable("curations", {
	id: integer("id").primaryKey({ autoIncrement: true }),
	notes: text("notes"),
	orchestraId: integer("orchestra_id")
		.notNull()
		.references(() => orchestras.id),
	performanceId: text("performance_id")
		.notNull()
		.references(() => performances.id, { onDelete: "cascade" }),
	songId: integer("song_id")
		.notNull()
		.references(() => songs.id),
	status: text("status", { enum: curationStatusValues })
		.notNull()
		.default(CurationStatus.autoProcessed),
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
	(table) => ({
		pk: primaryKey({ columns: [table.curationId, table.dancerId] }),
	}),
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
	(table) => ({
		pk: primaryKey({ columns: [table.curationId, table.singerId] }),
	}),
);

export const curationsRelations = relations(curations, ({ many, one }) => ({
	curationDancers: many(dancersToCurations),
	curationSingers: many(singersToCurations),
	orchestra: one(orchestras, {
		fields: [curations.orchestraId],
		references: [orchestras.id],
	}),
	performance: one(performances, {
		fields: [curations.performanceId],
		references: [performances.id],
	}),
	song: one(songs, {
		fields: [curations.songId],
		references: [songs.id],
	}),
}));

export const dancersRelations = relations(dancers, ({ many }) => ({
	curationDancers: many(dancersToCurations),
}));

export const curationDancersRelations = relations(dancersToCurations, ({ one }) => ({
	curation: one(curations, {
		fields: [dancersToCurations.curationId],
		references: [curations.id],
	}),
	dancer: one(dancers, {
		fields: [dancersToCurations.dancerId],
		references: [dancers.id],
	}),
}));
