import { radixThemePreset } from "radix-themes-tw";
import type { Config } from "tailwindcss";

export default {
	content: ["./app/**/{**,.client,.server}/**/*.{js,jsx,ts,tsx}"],
	presets: [radixThemePreset],
	theme: {
		extend: {
			fontFamily: {
				sans: [
					"Inter",
					"ui-sans-serif",
					"system-ui",
					"sans-serif",
					"Apple Color Emoji",
					"Segoe UI Emoji",
					"Segoe UI Symbol",
					"Noto Color Emoji",
				],
			},
		},
	},
} satisfies Config;
