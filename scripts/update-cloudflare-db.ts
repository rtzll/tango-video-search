#!/usr/bin/env node

/// <reference types="node" />

import { execFile, spawn } from "node:child_process";
import {
	appendFileSync,
	createWriteStream,
	lstatSync,
	mkdirSync,
	mkdtempSync,
	readdirSync,
	readlinkSync,
	renameSync,
	rmSync,
	symlinkSync,
	writeFileSync,
} from "node:fs";
import { basename, join, resolve } from "node:path";
import { pipeline } from "node:stream/promises";
import { promisify } from "node:util";

import { Effect } from "effect";

import { parseNamedRows } from "./sqlite-json.ts";

const DEFAULT_DATABASE = process.env.CLOUDFLARE_D1_DATABASE ?? "tango-video-search";
const execFileAsync = promisify(execFile);
const DATA_FILE_PATTERN = /^sqlite-(?<date>\d{4}-\d{2}-\d{2})\.db$/;
const EXPORT_TABLES = [
	"videos",
	"performances",
	"dancers",
	"orchestras",
	"singers",
	"songs",
	"curations",
	"dancers_to_curations",
	"singers_to_curations",
	"__drizzle_migrations",
	"tango_video_scraper_migrations",
];
const RESET_TABLES = [
	"app_metadata",
	"singers_to_curations",
	"dancers_to_curations",
	"curations",
	"performances",
	"videos",
	"singers",
	"dancers",
	"orchestras",
	"songs",
	"__drizzle_migrations",
	"tango_video_scraper_migrations",
];
const APP_METADATA_SCHEMA = `CREATE TABLE IF NOT EXISTS app_metadata (
  key text PRIMARY KEY,
  value text NOT NULL
);`;

interface BaseOptions {
	dataDir: string;
	database: string;
	dryRun: boolean;
	noLocalSymlink: boolean;
	outDir: string;
	reset: boolean;
	sqlOnly: boolean;
}

type ImportTarget = { kind: "local"; persistTo: string } | { kind: "remote" };

type Options = BaseOptions & { target: ImportTarget };

interface LatestDatabaseFile {
	date: string;
	name: string;
}

interface Metadata {
	fileName: string;
	updatedAt: string;
}

function printHelp() {
	console.log(`Update the Cloudflare D1 database from the latest local SQLite snapshot.

Usage:
  vp run db:update [options]

Options:
  --database <name>       D1 database name (default: CLOUDFLARE_D1_DATABASE or tango-video-search)
  --data-dir <path>       Local data directory to scan (default: data)
  --out-dir <path>        Directory for generated SQL files (default: .cache/cloudflare-db)
  --remote                Import into remote D1 instead of local D1
  --local                 Import into local D1 (default)
  --persist-to <path>     Local D1 persistence directory (default: .wrangler/state)
  --reset                 Drop known tables inside the generated import before loading data
  --sql-only              Only write the SQL dump; do not import it
  --no-local-symlink      Skip updating data/sqlite.db
  --dry-run               Print commands without executing them
  -h, --help              Show help
`);
}

function readOptionValue(args: string[], index: number, optionName: string) {
	const value = args[index + 1];
	if (!value || value.startsWith("-")) {
		throw new Error(`Missing value for ${optionName}`);
	}
	return value;
}

function parseArgs(): Options {
	const args = process.argv.slice(2);
	const options: BaseOptions = {
		dataDir: "data",
		database: DEFAULT_DATABASE,
		dryRun: false,
		noLocalSymlink: false,
		outDir: ".cache/cloudflare-db",
		reset: false,
		sqlOnly: false,
	};
	let targetKind: ImportTarget["kind"] = "local";
	let persistTo = ".wrangler/state";

	for (let index = 0; index < args.length; index++) {
		const arg = args[index];
		switch (arg) {
			case "--database": {
				options.database = readOptionValue(args, index, arg);
				index += 1;
				break;
			}
			case "--data-dir": {
				options.dataDir = readOptionValue(args, index, arg);
				index += 1;
				break;
			}
			case "--out-dir": {
				options.outDir = readOptionValue(args, index, arg);
				index += 1;
				break;
			}
			case "--remote": {
				targetKind = "remote";
				break;
			}
			case "--local": {
				targetKind = "local";
				break;
			}
			case "--persist-to": {
				persistTo = readOptionValue(args, index, arg);
				index += 1;
				break;
			}
			case "--reset": {
				options.reset = true;
				break;
			}
			case "--sql-only": {
				options.sqlOnly = true;
				break;
			}
			case "--no-local-symlink": {
				options.noLocalSymlink = true;
				break;
			}
			case "--dry-run": {
				options.dryRun = true;
				break;
			}
			case "--help":
			case "-h": {
				printHelp();
				process.exit(0);
			}
			default: {
				throw new Error(`Unknown argument: ${arg}`);
			}
		}
	}

	return {
		...options,
		target: targetKind === "remote" ? { kind: "remote" } : { kind: "local", persistTo },
	};
}

function getLatestDatabaseFile(dataDir: string): LatestDatabaseFile {
	const candidates = readdirSync(dataDir)
		.map((name): LatestDatabaseFile | null => {
			const match = name.match(DATA_FILE_PATTERN);
			const date = match?.groups?.date;
			if (!date) {
				return null;
			}
			const path = join(dataDir, name);
			return lstatSync(path).isFile() ? { date, name } : null;
		})
		.filter((candidate): candidate is LatestDatabaseFile => Boolean(candidate))
		.toSorted((a, b) => a.date.localeCompare(b.date));

	if (candidates.length === 0) {
		throw new Error(`No database files found in ${dataDir} (expected sqlite-YYYY-MM-DD.db).`);
	}

	return candidates[candidates.length - 1];
}

function temporaryDirectory(parent: string, prefix: string) {
	return Effect.acquireRelease(
		Effect.sync(() => mkdtempSync(join(parent, prefix))),
		(path) => Effect.sync(() => rmSync(path, { force: true, recursive: true })),
	);
}

const updateLocalSymlink = Effect.fnUntraced(function* (dataDir: string, targetFileName: string) {
	const symlinkPath = join(dataDir, "sqlite.db");
	if (lstatSync(symlinkPath, { throwIfNoEntry: false })?.isSymbolicLink()) {
		if (readlinkSync(symlinkPath) === targetFileName) {
			console.log(`Local symlink already up to date: ${symlinkPath} -> ${targetFileName}`);
			return;
		}
	}

	const directory = yield* temporaryDirectory(dataDir, ".sqlite-link-");
	const temporaryLink = join(directory, "sqlite.db");
	symlinkSync(targetFileName, temporaryLink);
	renameSync(temporaryLink, symlinkPath);
	console.log(`Updated local symlink: ${symlinkPath} -> ${targetFileName}`);
});

function quoteSqlString(value: string) {
	return `'${value.replaceAll("'", "''")}'`;
}

function quoteSqlIdentifier(value: string) {
	return `"${value.replaceAll('"', '""')}"`;
}

function sqlite(databasePath: string, args: string[]) {
	return Effect.tryPromise({
		try: (signal) =>
			execFileAsync("sqlite3", ["-batch", databasePath, ...args], {
				encoding: "utf8",
				maxBuffer: 1024 * 1024 * 128,
				signal,
			}),
		catch: (cause) => (cause instanceof Error ? cause : new Error(String(cause))),
	}).pipe(Effect.map(({ stdout }) => stdout));
}

function sqliteNamedRows(databasePath: string, sql: string) {
	return Effect.map(sqlite(databasePath, ["-json", sql]), parseNamedRows);
}

const getExportTables = Effect.fnUntraced(function* (databasePath: string) {
	const rows = yield* sqliteNamedRows(
		databasePath,
		"SELECT name FROM sqlite_schema WHERE type = 'table' AND sql IS NOT NULL ORDER BY name;",
	);
	const tables = rows
		.map((row) => row.name)
		.filter((name) => !name.startsWith("sqlite_") && name !== "app_metadata");
	const tableSet = new Set(tables);
	const knownTables = EXPORT_TABLES.filter((name) => tableSet.has(name));
	const remainingTables = tables.filter((name) => !EXPORT_TABLES.includes(name));

	return [...knownTables, ...remainingTables];
});

function getTableColumns(databasePath: string, table: string) {
	return Effect.map(
		sqliteNamedRows(databasePath, `PRAGMA table_info(${quoteSqlIdentifier(table)});`),
		(rows) => rows.map((row) => row.name),
	);
}

function buildInsertSelect(table: string, columns: string[]) {
	const insertPrefix = `INSERT INTO ${quoteSqlIdentifier(table)} (${columns
		.map(quoteSqlIdentifier)
		.join(", ")}) VALUES (`;
	const values = columns
		.map((column) => `quote(${quoteSqlIdentifier(column)})`)
		.join(" || ',' || ");

	return `SELECT ${quoteSqlString(insertPrefix)} || ${values} || ');' FROM ${quoteSqlIdentifier(table)};`;
}

function makeSchemaIdempotent(schema: string) {
	return schema
		.replace(/^CREATE TABLE(?! IF NOT EXISTS)/gm, "CREATE TABLE IF NOT EXISTS")
		.replace(/^CREATE UNIQUE INDEX(?! IF NOT EXISTS)/gm, "CREATE UNIQUE INDEX IF NOT EXISTS")
		.replace(/^CREATE INDEX(?! IF NOT EXISTS)/gm, "CREATE INDEX IF NOT EXISTS");
}

function buildRefreshSql() {
	const deletes = RESET_TABLES.map((table) => `DELETE FROM ${quoteSqlIdentifier(table)};`).join(
		"\n",
	);
	return `${APP_METADATA_SCHEMA}\n${deletes}`;
}

function runProcess(command: string, args: string[], outputPath?: string) {
	return Effect.acquireUseRelease(
		Effect.sync(() => {
			const child = spawn(command, args, {
				stdio: outputPath ? ["ignore", "pipe", "inherit"] : "inherit",
			});
			const closed = new Promise<Error | undefined>((resolve) => {
				let processError: Error | undefined;
				child.on("error", (error) => {
					processError = error;
				});
				child.once("close", (code, signal) => {
					resolve(
						processError ??
							(code === 0
								? undefined
								: new Error(`${command} exited with ${signal ?? `code ${code}`}`)),
					);
				});
			});
			return { child, closed };
		}),
		({ child, closed }) => {
			const checkExit = Effect.gen(function* () {
				const error = yield* Effect.promise(() => closed);
				if (error) {
					return yield* Effect.fail(error);
				}
			});
			const stdout = child.stdout;
			if (!stdout || !outputPath) {
				return checkExit;
			}
			const write = Effect.tryPromise({
				try: (signal) =>
					pipeline(stdout, createWriteStream(outputPath, { flags: "a" }), { signal }),
				catch: (cause) => new Error(`Could not write to ${outputPath}`, { cause }),
			});
			return Effect.all([checkExit, write], { concurrency: "unbounded", discard: true });
		},
		({ child, closed }) =>
			Effect.promise(async () => {
				if (child.pid !== undefined && child.exitCode === null && child.signalCode === null) {
					child.kill("SIGKILL");
				}
				await closed;
			}),
	);
}

const writeSqlDump = Effect.fnUntraced(function* (
	databasePath: string,
	outputPath: string,
	metadata: Metadata,
	{ dryRun, reset }: Pick<Options, "dryRun" | "reset">,
) {
	console.log(`$ sqlite3 ${databasePath} .schema --nosys > ${outputPath}`);
	console.log(`$ sqlite3 ${databasePath} <table exports> >> ${outputPath}`);

	if (dryRun) {
		return;
	}

	const schema = yield* sqlite(databasePath, [".schema --nosys"]);
	// Keep destructive drops in the same import file as replacement data.
	// D1 can then roll back the whole refresh if the import fails.
	const drops = reset
		? RESET_TABLES.map((table) => `DROP TABLE IF EXISTS ${table};`).join("\n")
		: "";
	const schemaSql = reset ? schema : makeSchemaIdempotent(schema);
	const refreshSql = reset ? "" : buildRefreshSql();
	writeFileSync(outputPath, `PRAGMA foreign_keys=OFF;\n${drops}\n${schemaSql}\n${refreshSql}\n`);

	const tables = yield* getExportTables(databasePath);
	for (const table of tables) {
		const columns = yield* getTableColumns(databasePath, table);
		if (columns.length > 0) {
			const sql = buildInsertSelect(table, columns);
			yield* runProcess("sqlite3", ["-batch", databasePath, sql], outputPath);
			appendFileSync(outputPath, "\n");
		}
	}

	appendFileSync(
		outputPath,
		`
${APP_METADATA_SCHEMA}
INSERT OR REPLACE INTO app_metadata (key, value) VALUES
  ('database_file', ${quoteSqlString(metadata.fileName)}),
  ('database_updated_at', ${quoteSqlString(metadata.updatedAt)});
`,
	);
});

const importSql = Effect.fnUntraced(function* (sqlPath: string, options: Options) {
	const target = options.target.kind === "remote" ? "--remote" : "--local";
	const wranglerBaseArgs = ["d1", "execute", options.database, target];
	if (options.target.kind === "local") {
		wranglerBaseArgs.push("--persist-to", options.target.persistTo);
	}

	const args = [...wranglerBaseArgs, "--file", sqlPath];
	const pretty = args.map((arg) => (/\s/.test(arg) ? JSON.stringify(arg) : arg)).join(" ");
	console.log(`$ wrangler ${pretty}`);
	if (!options.dryRun) {
		yield* runProcess("wrangler", args);
	}
});

const main = Effect.gen(function* () {
	const options = parseArgs();
	const latest = getLatestDatabaseFile(options.dataDir);
	const dataDir = resolve(options.dataDir);
	const outDir = resolve(options.outDir);
	const databasePath = join(dataDir, latest.name);
	const sqlPath = join(outDir, `${basename(latest.name, ".db")}.sql`);
	const updatedAt = new Date(`${latest.date}T00:00:00.000Z`).toISOString();

	console.log(`Latest database file: ${databasePath}`);
	console.log(`D1 database: ${options.database} (${options.target.kind})`);

	let outputPath = sqlPath;
	if (!options.dryRun) {
		mkdirSync(outDir, { recursive: true });
		const directory = yield* temporaryDirectory(outDir, ".sql-dump-");
		outputPath = join(directory, basename(sqlPath));
	}
	yield* writeSqlDump(databasePath, outputPath, { fileName: latest.name, updatedAt }, options);
	if (!options.dryRun) {
		renameSync(outputPath, sqlPath);
	}
	console.log(`SQL dump: ${sqlPath}`);

	if (!options.sqlOnly) {
		yield* importSql(sqlPath, options);
	}

	if (!options.noLocalSymlink) {
		if (options.dryRun) {
			console.log(
				`[dry-run] Would update local symlink: ${join(dataDir, "sqlite.db")} -> ${latest.name}`,
			);
		} else {
			yield* updateLocalSymlink(dataDir, latest.name);
		}
	}

	if (options.sqlOnly) {
		return;
	}

	console.log(
		options.dryRun
			? "Cloudflare D1 database update dry run completed."
			: "Cloudflare D1 database update completed.",
	);
}).pipe(Effect.scoped);

const shutdown = new AbortController();
function interrupt(signal: NodeJS.Signals) {
	process.exitCode = signal === "SIGINT" ? 130 : 143;
	shutdown.abort();
}
process.once("SIGINT", interrupt);
process.once("SIGTERM", interrupt);

Effect.runPromise(main, { signal: shutdown.signal })
	.catch((error: unknown) => {
		if (!shutdown.signal.aborted) {
			console.error(error instanceof Error ? `Error: ${error.message}` : "Unknown error");
			process.exitCode = 1;
		}
	})
	.finally(() => {
		process.off("SIGINT", interrupt);
		process.off("SIGTERM", interrupt);
	});
