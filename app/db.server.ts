import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";

import * as schema from "../schema";

// TODO: make readonly in production
const sqlite = new Database(process.env.DATABASE_PATH || "tango_videos.db");
// configure sqlite
sqlite.exec("pragma journal_mode = wal;");
sqlite.exec("pragma synchronous = normal;");
sqlite.exec("pragma busy_timeout = 5000;");
sqlite.exec("pragma cache_size = 2000;");
sqlite.exec("pragma temp_store = memory;");
sqlite.exec("pragma mmap_size = 268435456;");
sqlite.exec("pragma foreign_keys = on;");
export const db = drizzle({ client: sqlite, schema });
