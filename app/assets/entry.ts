import { run } from "remix/component";

import { SearchControls, SearchControlsEntryId } from "./search-controls.tsx";

const app = run({
	async loadModule(_moduleUrl, exportName) {
		if (exportName === SearchControlsEntryId) {
			return SearchControls;
		}
		throw new Error(`Unknown client entry: ${exportName}`);
	},
});

app.ready().catch((error: unknown) => {
	console.error("Search controls hydration failed:", error);
});
