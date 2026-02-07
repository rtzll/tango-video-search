#!/usr/bin/env bun

import {
	existsSync,
	lstatSync,
	readdirSync,
	readlinkSync,
	symlinkSync,
	unlinkSync,
} from "node:fs";
import { join } from "node:path";
import { $ } from "bun";

type Options = {
	app: string;
	dataDir: string;
	dryRun: boolean;
	noRestart: boolean;
	noLocalSymlink: boolean;
	remoteDir: string;
};

function parseArgs(): Options {
	const args = process.argv.slice(2);
	let app = process.env.FLY_APP_NAME ?? "tango-video-search";
	let dataDir = "data";
	let dryRun = false;
	let noRestart = false;
	let noLocalSymlink = false;
	let remoteDir = "/data";

	for (let i = 0; i < args.length; i++) {
		const arg = args[i];
		switch (arg) {
			case "--app":
				app = args[++i] ?? app;
				break;
			case "--data-dir":
				dataDir = args[++i] ?? dataDir;
				break;
			case "--remote-dir":
				remoteDir = args[++i] ?? remoteDir;
				break;
			case "--dry-run":
				dryRun = true;
				break;
			case "--no-restart":
				noRestart = true;
				break;
			case "--no-local-symlink":
				noLocalSymlink = true;
				break;
			case "--help":
			case "-h":
				printHelp();
				process.exit(0);
				break;
			default:
				throw new Error(`Unknown argument: ${arg}`);
		}
	}

	return { app, dataDir, dryRun, noRestart, noLocalSymlink, remoteDir };
}

function printHelp() {
	console.log(`Update production SQLite database on Fly.io.

Usage:
  bun run db:update [options]

Options:
  --app <name>             Fly app name (default: FLY_APP_NAME or tango-video-search)
  --data-dir <path>        Local data directory to scan (default: data)
  --remote-dir <path>      Remote data directory on Fly volume (default: /data)
  --dry-run                Print commands without executing
  --no-local-symlink       Skip updating local data/sqlite.db symlink
  --no-restart             Skip fly apps restart
  -h, --help               Show help
`);
}

async function runOrThrow(
	command: string,
	args: string[],
	options: Pick<Options, "dryRun">,
) {
	const pretty = [
		command,
		...args.map((arg) => (/\s/.test(arg) ? JSON.stringify(arg) : arg)),
	].join(" ");
	console.log(`$ ${pretty}`);

	if (options.dryRun) {
		return;
	}

	await $`${[command, ...args]}`;
}

function isRemoteAlreadyExistsError(error: unknown) {
	if (!error || typeof error !== "object") {
		return false;
	}

	const maybeError = error as {
		message?: unknown;
		stderr?: unknown;
	};

	const message =
		typeof maybeError.message === "string" ? maybeError.message : "";
	const stderr = maybeError.stderr ? String(maybeError.stderr) : "";
	const combined = `${message}\n${stderr}`;

	return combined.includes("already exists");
}

function getLatestDatabaseFile(dataDir: string) {
	const regex = /^sqlite-(\d{4}-\d{2}-\d{2})\.db$/;
	const candidates = readdirSync(dataDir)
		.map((name) => {
			const match = name.match(regex);
			if (!match) return null;
			const fullPath = join(dataDir, name);
			if (!lstatSync(fullPath).isFile()) return null;
			return { name, date: match[1] };
		})
		.filter((entry) => entry !== null);

	if (candidates.length === 0) {
		throw new Error(
			`No database files found in ${dataDir} (expected sqlite-YYYY-MM-DD.db).`,
		);
	}

	candidates.sort((a, b) => a.date.localeCompare(b.date));
	return candidates[candidates.length - 1].name;
}

function updateLocalSymlink(dataDir: string, targetFileName: string) {
	const symlinkPath = join(dataDir, "sqlite.db");
	const target = targetFileName;

	if (existsSync(symlinkPath)) {
		const stat = lstatSync(symlinkPath);
		if (stat.isSymbolicLink()) {
			const currentTarget = readlinkSync(symlinkPath);
			if (currentTarget === target) {
				console.log(
					`Local symlink already up to date: ${symlinkPath} -> ${currentTarget}`,
				);
				return;
			}
		}
		unlinkSync(symlinkPath);
	}

	symlinkSync(target, symlinkPath);
	console.log(`Updated local symlink: ${symlinkPath} -> ${target}`);
}

async function main() {
	const options = parseArgs();
	const latestDb = getLatestDatabaseFile(options.dataDir);
	const localDbPath = join(options.dataDir, latestDb);
	const remoteDbPath = `${options.remoteDir}/${latestDb}`;
	const remoteSymlink = `${options.remoteDir}/sqlite.db`;

	console.log(`Latest database file: ${localDbPath}`);

	if (!options.noLocalSymlink) {
		if (options.dryRun) {
			console.log(
				`[dry-run] Would update local symlink: ${join(options.dataDir, "sqlite.db")} -> ${latestDb}`,
			);
		} else {
			updateLocalSymlink(options.dataDir, latestDb);
		}
	}

	try {
		await runOrThrow(
			"fly",
			["ssh", "sftp", "put", localDbPath, remoteDbPath, "-a", options.app],
			options,
		);
	} catch (error) {
		if (!isRemoteAlreadyExistsError(error)) {
			throw error;
		}
		console.log(`Remote file already exists, skipping upload: ${remoteDbPath}`);
	}

	await runOrThrow(
		"fly",
		[
			"ssh",
			"console",
			"-a",
			options.app,
			"-C",
			`ln -sfn ${remoteDbPath} ${remoteSymlink}`,
		],
		options,
	);

	await runOrThrow(
		"fly",
		["ssh", "console", "-a", options.app, "-C", `ls -l ${remoteSymlink}`],
		options,
	);

	if (!options.noRestart) {
		await runOrThrow("fly", ["apps", "restart", options.app], options);
	}

	console.log("Production database update completed.");
}

main().catch((error) => {
	console.error(
		error instanceof Error ? `Error: ${error.message}` : "Unknown error",
	);
	process.exit(1);
});
