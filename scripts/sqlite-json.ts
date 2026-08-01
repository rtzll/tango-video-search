interface NamedRow {
	readonly name: string;
}

function isNamedRow(row: unknown): row is NamedRow {
	return typeof row === "object" && row !== null && "name" in row && typeof row.name === "string";
}

export function parseNamedRows(output: string): NamedRow[] {
	if (!output.trim()) {
		return [];
	}
	const parsed: unknown = JSON.parse(output);
	if (!Array.isArray(parsed) || !parsed.every(isNamedRow)) {
		throw new Error("Invalid SQLite JSON named rows");
	}
	return parsed;
}
