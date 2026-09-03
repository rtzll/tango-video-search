import { fileURLToPath } from "node:url";

import { cloudflare } from "@cloudflare/vite-plugin";
import { reactRouter } from "@react-router/dev/vite";
import stylex from "@stylexjs/unplugin";
import { defineConfig } from "vite";

const rootDir = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
	plugins: [
		stylex.vite({
			devMode: "css-only",
			runtimeInjection: false,
			unstable_moduleResolution: {
				rootDir,
				type: "commonJS",
			},
			useCSSLayers: { before: ["reset"] },
		}),
		cloudflare({
			viteEnvironment: { name: "ssr" },
		}),
		reactRouter(),
	],
	resolve: {
		alias: {
			"~": fileURLToPath(new URL("app", import.meta.url)),
		},
	},
});
