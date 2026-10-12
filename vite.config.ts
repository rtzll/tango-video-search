import { cloudflare } from "@cloudflare/vite-plugin";
import { defineConfig } from "vite";

export default defineConfig({
	environments: {
		client: {
			build: {
				rollupOptions: {
					input: "./app/assets/entry.ts",
					output: {
						assetFileNames: "assets/[name]-[hash][extname]",
						chunkFileNames: "assets/[name]-[hash].js",
						entryFileNames: "assets/entry.js",
					},
				},
			},
		},
	},
	plugins: [cloudflare()],
});
