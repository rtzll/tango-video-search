import { cloudflare } from "@cloudflare/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import type { PluginOption } from "vite";
import { defineConfig } from "vite-plus";

export default defineConfig(async ({ mode }) => {
	if (mode === "analyze") {
		const { visualizer } = await import("rollup-plugin-visualizer");
		return {
			build: { outDir: "build/analyze/client", sourcemap: "hidden" },
			plugins: [
				tailwindcss(),
				visualizer({
					filename: "build/analyze/client-bundle.html",
					gzipSize: true,
					sourcemap: true,
					template: "treemap",
					title: "Tango Video Search client bundle",
				}) as PluginOption,
			],
		};
	}

	return {
		plugins: [cloudflare({ viteEnvironment: { name: "ssr" } }), tailwindcss()],
		environments: {
			client: { build: { outDir: "build/client" } },
			ssr: { build: { outDir: "build/server" } },
		},
	};
});
