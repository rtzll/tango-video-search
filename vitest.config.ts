import { cloudflareTest } from "@cloudflare/vitest-plugin";
import { defineConfig } from "vite-plus";

export default defineConfig({
	plugins: [
		cloudflareTest({
			wrangler: { configPath: "./wrangler.jsonc" },
		}),
	],
	test: {
		// The Cloudflare pool sends cached modules in one WebSocket message that can exceed 32 MiB.
		fsModuleCache: false,
		include: ["app/**/*.test.ts", "scripts/**/*.test.ts"],
	},
});
