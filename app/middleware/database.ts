import { env } from "cloudflare:workers";
import { createContextKey, type Middleware } from "remix/router";

import { createDatabase, type AppDatabase } from "../db.server.ts";

const databaseContextKey = createContextKey<AppDatabase>();

export function loadDatabase(): Middleware<{
	key: typeof databaseContextKey;
	value: AppDatabase;
	property: "db";
}> {
	return (context, next) => {
		context.set(databaseContextKey, createDatabase(env.DB), { property: "db" });
		return next();
	};
}
