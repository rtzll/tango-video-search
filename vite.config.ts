import { cloudflare } from "@cloudflare/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite-plus";

export default defineConfig({
	plugins: [cloudflare({ viteEnvironment: { name: "ssr" } }), tailwindcss()],
	environments: {
		client: { build: { outDir: "build/client" } },
		ssr: { build: { outDir: "build/server" } },
	},
});
