#!/usr/bin/env node

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
  --reset                 Drop known tables before importing
  --sql-only              Only write the SQL dump; do not import it
  --no-local-symlink      Skip updating data/sqlite.db
  --dry-run               Print commands without executing them
  -h, --help              Show help
`);
}

function readOptionValue(args, index, optionName) {
	const value = args[index + 1];
	if (!value || value.startsWith("-")) {
		throw new Error(`Missing value for ${optionName}`);
	}
	return value;
}

function parseArgs() {
	const args = process.argv.slice(2);
	const options = {
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

function getLatestDatabaseFile(dataDir) {
	const candidates = readdirSync(dataDir)
		.map((name) => {
			const match = name.match(DATA_FILE_PATTERN);
			const date = match?.groups?.date;
			if (!date) {
				return null;
			}
			const path = join(dataDir, name);
			return lstatSync(path).isFile() ? { date, name } : null;
		})
		.filter(Boolean)
		.toSorted((a, b) => a.date.localeCompare(b.date));

	if (candidates.length === 0) {
		throw new Error(`No database files found in ${dataDir} (expected sqlite-YYYY-MM-DD.db).`);
	}

	return candidates[candidates.length - 1];
}

function updateLocalSymlink(dataDir, targetFileName) {
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

function quoteSqlString(value) {
	return `'${value.replaceAll("'", "''")}'`;
}

function quoteSqlIdentifier(value) {
	return `"${value.replaceAll('"', '""')}"`;
}

function sqlite(databasePath, args) {
	const result = spawnSync("sqlite3", ["-batch", databasePath, ...args], {
		encoding: "utf8",
		maxBuffer: 1024 * 1024 * 128,
	});

	if (result.error) {
		throw result.error;
	}

	if (result.status !== 0) {
		throw new Error(result.stderr.trim() || `sqlite3 exited with code ${result.status}`);
	}

	return result.stdout;
}

function sqliteJson(databasePath, sql) {
	const output = sqlite(databasePath, ["-json", sql]).trim();
	return output ? JSON.parse(output) : [];
}

function getExportTables(databasePath) {
	const tables = sqliteJson(
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

function getTableColumns(databasePath, table) {
	return sqliteJson(databasePath, `PRAGMA table_info(${quoteSqlIdentifier(table)});`).map(
		(row) => row.name,
	);
}

function buildInsertSelect(table, columns) {
	const insertPrefix = `INSERT INTO ${quoteSqlIdentifier(table)} (${columns
		.map(quoteSqlIdentifier)
		.join(", ")}) VALUES (`;
	const values = columns
		.map((column) => `quote(${quoteSqlIdentifier(column)})`)
		.join(" || ',' || ");

	return `SELECT ${quoteSqlString(insertPrefix)} || ${values} || ');' FROM ${quoteSqlIdentifier(table)};`;
}

async function run(command, args, { dryRun }) {
	const pretty = [command, ...args.map((arg) => (/\s/.test(arg) ? JSON.stringify(arg) : arg))].join(
		" ",
	);
	console.log(`$ ${pretty}`);

	if (dryRun) {
		return;
	}

	await new Promise((resolvePromise, rejectPromise) => {
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

async function appendSqlQuery(databasePath, sql, outputPath) {
	await new Promise((resolvePromise, rejectPromise) => {
		const output = createWriteStream(outputPath, { flags: "a" });
		const child = spawn("sqlite3", ["-batch", databasePath, sql], {
			stdio: ["ignore", "pipe", "inherit"],
		});

		let settled = false;
		const rejectOnce = (error) => {
			if (!settled) {
				settled = true;
				rejectPromise(error);
			}
		};

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

async function writeSqlDump(databasePath, outputPath, metadata, { dryRun }) {
	console.log(`$ sqlite3 ${databasePath} .schema --nosys > ${outputPath}`);
	console.log(`$ sqlite3 ${databasePath} <table exports> >> ${outputPath}`);

	if (dryRun) {
		return;
	}

	const schema = sqlite(databasePath, [".schema --nosys"]);
	writeFileSync(outputPath, `PRAGMA foreign_keys=OFF;\n${schema}\n`);

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
CREATE TABLE IF NOT EXISTS app_metadata (
  key text PRIMARY KEY,
  value text NOT NULL
);
INSERT OR REPLACE INTO app_metadata (key, value) VALUES
  ('database_file', ${quoteSqlString(metadata.fileName)}),
  ('database_updated_at', ${quoteSqlString(metadata.updatedAt)});
`,
	);
}

function writeResetSql(outputPath) {
	const drops = RESET_TABLES.map((table) => `DROP TABLE IF EXISTS ${table};`).join("\n");
	writeFileSync(
		outputPath,
		`PRAGMA foreign_keys=OFF;
${drops}
`,
	);
}

async function importSql(sqlPath, options) {
	const target = options.remote ? "--remote" : "--local";
	const wranglerBaseArgs = ["d1", "execute", options.database, target];
	if (!options.remote && options.persistTo) {
		wranglerBaseArgs.push("--persist-to", options.persistTo);
	}

	if (options.reset) {
		const resetPath = join(options.outDir, "reset.sql");
		if (!options.dryRun) {
			writeResetSql(resetPath);
		}
		await run("wrangler", [...wranglerBaseArgs, "--file", resetPath], options);
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
