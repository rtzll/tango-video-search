export function normalize(str: string): string {
	return str
		.normalize("NFD") // Decompose characters into base + diacritics
		.replace(/\p{M}/gu, "") // Remove diacritics
		.toLowerCase() // Convert to lowercase
		.trim() // Remove leading/trailing whitespace
		.replace(/[^a-z0-9\s-]/g, "") // Keep only alphanumeric, spaces, and hyphens
		.replace(/\s+/g, " "); // Replace multiple spaces with single space
}
