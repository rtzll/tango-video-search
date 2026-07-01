#!/usr/bin/env node

/// <reference types="node" />

import { spawn, spawnSync } from "node:child_process";
import {
	appendFileSync,
	createWriteStream,
	existsSync,
	lstatSync,
	mkdirSync,
	readdirSync,
	readlinkSync,
	symlinkSync,
	unlinkSync,
	writeFileSync,
} from "node:fs";
import { basename, join, resolve } from "node:path";

const DEFAULT_DATABASE = process.env.CLOUDFLARE_D1_DATABASE ?? "tango-video-search";
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

interface Options {
	dataDir: string;
	database: string;
	dryRun: boolean;
	noLocalSymlink: boolean;
	outDir: string;
	persistTo: string;
	remote: boolean;
	reset: boolean;
	sqlOnly: boolean;
}

interface LatestDatabaseFile {
	date: string;
	name: string;
}

interface Metadata {
	fileName: string;
	updatedAt: string;
}

interface SqliteTableRow {
	name: string;
}

interface TableInfoRow {
	name: string;
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
	const options: Options = {
		dataDir: "data",
		database: DEFAULT_DATABASE,
		dryRun: false,
		noLocalSymlink: false,
		outDir: ".cache/cloudflare-db",
		persistTo: ".wrangler/state",
		remote: false,
		reset: false,
		sqlOnly: false,
	};

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
				options.remote = true;
				break;
			}
			case "--local": {
				options.remote = false;
				break;
			}
			case "--persist-to": {
				options.persistTo = readOptionValue(args, index, arg);
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

	return options;
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

function updateLocalSymlink(dataDir: string, targetFileName: string) {
	const symlinkPath = join(dataDir, "sqlite.db");

	if (existsSync(symlinkPath)) {
		const stat = lstatSync(symlinkPath);
		if (stat.isSymbolicLink() && readlinkSync(symlinkPath) === targetFileName) {
			console.log(`Local symlink already up to date: ${symlinkPath} -> ${targetFileName}`);
			return;
		}
		unlinkSync(symlinkPath);
	}

	symlinkSync(targetFileName, symlinkPath);
	console.log(`Updated local symlink: ${symlinkPath} -> ${targetFileName}`);
}

function quoteSqlString(value: string) {
	return `'${value.replaceAll("'", "''")}'`;
}

function quoteSqlIdentifier(value: string) {
	return `"${value.replaceAll('"', '""')}"`;
}

function sqlite(databasePath: string, args: string[]) {
	const result = spawnSync("sqlite3", ["-batch", databasePath, ...args], {
		encoding: "utf8",
		maxBuffer: 1024 * 1024 * 128,
	});

	if (result.error) {
		throw result.error;
	}

	if (result.status !== 0) {
		throw new Error(String(result.stderr).trim() || `sqlite3 exited with code ${result.status}`);
	}

	return result.stdout;
}

function sqliteJson<T>(databasePath: string, sql: string) {
	const output = sqlite(databasePath, ["-json", sql]).trim();
	return output ? (JSON.parse(output) as T[]) : [];
}

function getExportTables(databasePath: string) {
	const tables = sqliteJson<SqliteTableRow>(
		databasePath,
		"SELECT name FROM sqlite_schema WHERE type = 'table' AND sql IS NOT NULL ORDER BY name;",
	)
		.map((row) => row.name)
		.filter((name) => !name.startsWith("sqlite_") && name !== "app_metadata");
	const tableSet = new Set(tables);
	const knownTables = EXPORT_TABLES.filter((name) => tableSet.has(name));
	const remainingTables = tables.filter((name) => !EXPORT_TABLES.includes(name));

	return [...knownTables, ...remainingTables];
}

function getTableColumns(databasePath: string, table: string) {
	return sqliteJson<TableInfoRow>(
		databasePath,
		`PRAGMA table_info(${quoteSqlIdentifier(table)});`,
	).map((row) => row.name);
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

async function run(command: string, args: string[], { dryRun }: Pick<Options, "dryRun">) {
	const pretty = [command, ...args.map((arg) => (/\s/.test(arg) ? JSON.stringify(arg) : arg))].join(
		" ",
	);
	console.log(`$ ${pretty}`);

	if (dryRun) {
		return;
	}

	await new Promise<void>((resolvePromise, rejectPromise) => {
		const child = spawn(command, args, { stdio: "inherit" });
		child.on("error", rejectPromise);
		child.on("close", (code) => {
			if (code === 0) {
				resolvePromise();
			} else {
				rejectPromise(new Error(`${command} exited with code ${code}`));
			}
		});
	});
}

async function appendSqlQuery(databasePath: string, sql: string, outputPath: string) {
	await new Promise<void>((resolvePromise, rejectPromise) => {
		const output = createWriteStream(outputPath, { flags: "a" });
		const child = spawn("sqlite3", ["-batch", databasePath, sql], {
			stdio: ["ignore", "pipe", "inherit"],
		});

		let settled = false;
		const rejectOnce = (error: Error) => {
			if (!settled) {
				settled = true;
				rejectPromise(error);
			}
		};

		if (!child.stdout) {
			rejectOnce(new Error("sqlite3 stdout stream was not available"));
			return;
		}

		child.stdout.pipe(output, { end: false });
		child.on("error", rejectOnce);
		output.on("error", rejectOnce);
		child.on("close", (code) => {
			output.end("\n", () => {
				if (settled) {
					return;
				}
				settled = true;
				if (code === 0) {
					resolvePromise();
				} else {
					rejectPromise(new Error(`sqlite3 exited with code ${code}`));
				}
			});
		});
	});
}

async function writeSqlDump(
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

	const schema = sqlite(databasePath, [".schema --nosys"]);
	// Keep destructive drops in the same import file as replacement data.
	// D1 can then roll back the whole refresh if the import fails.
	const drops = reset
		? RESET_TABLES.map((table) => `DROP TABLE IF EXISTS ${table};`).join("\n")
		: "";
	const schemaSql = reset ? schema : makeSchemaIdempotent(schema);
	const refreshSql = reset ? "" : buildRefreshSql();
	writeFileSync(outputPath, `PRAGMA foreign_keys=OFF;\n${drops}\n${schemaSql}\n${refreshSql}\n`);

	await getExportTables(databasePath).reduce(async (previous, table) => {
		await previous;
		const columns = getTableColumns(databasePath, table);
		if (columns.length > 0) {
			await appendSqlQuery(databasePath, buildInsertSelect(table, columns), outputPath);
		}
	}, Promise.resolve());

	appendFileSync(
		outputPath,
		`
${APP_METADATA_SCHEMA}
INSERT OR REPLACE INTO app_metadata (key, value) VALUES
  ('database_file', ${quoteSqlString(metadata.fileName)}),
  ('database_updated_at', ${quoteSqlString(metadata.updatedAt)});
`,
	);
}

async function importSql(sqlPath: string, options: Options) {
	const target = options.remote ? "--remote" : "--local";
	const wranglerBaseArgs = ["d1", "execute", options.database, target];
	if (!options.remote && options.persistTo) {
		wranglerBaseArgs.push("--persist-to", options.persistTo);
	}

	await run("wrangler", [...wranglerBaseArgs, "--file", sqlPath], options);
}

async function main() {
	const options = parseArgs();
	const latest = getLatestDatabaseFile(options.dataDir);
	const dataDir = resolve(options.dataDir);
	const outDir = resolve(options.outDir);
	const databasePath = join(dataDir, latest.name);
	const sqlPath = join(outDir, `${basename(latest.name, ".db")}.sql`);
	const updatedAt = new Date(`${latest.date}T00:00:00.000Z`).toISOString();

	console.log(`Latest database file: ${databasePath}`);
	console.log(`D1 database: ${options.database} (${options.remote ? "remote" : "local"})`);

	if (!options.dryRun) {
		mkdirSync(outDir, { recursive: true });
	}

	if (!options.noLocalSymlink) {
		if (options.dryRun) {
			console.log(
				`[dry-run] Would update local symlink: ${join(dataDir, "sqlite.db")} -> ${latest.name}`,
			);
		} else {
			updateLocalSymlink(dataDir, latest.name);
		}
	}

	await writeSqlDump(
		databasePath,
		sqlPath,
		{
			fileName: latest.name,
			updatedAt,
		},
		options,
	);

	console.log(`SQL dump: ${sqlPath}`);

	if (options.sqlOnly) {
		return;
	}

	await importSql(sqlPath, options);
	console.log(
		options.dryRun
			? "Cloudflare D1 database update dry run completed."
			: "Cloudflare D1 database update completed.",
	);
}

main().catch((error) => {
	console.error(error instanceof Error ? `Error: ${error.message}` : "Unknown error");
	process.exit(1);
});
