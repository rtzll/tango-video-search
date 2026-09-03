import * as stylex from "@stylexjs/stylex";
import { useEffect } from "react";
import { Links, Meta, Outlet, Scripts, ScrollRestoration } from "react-router";

import { colors } from "./styles/tokens.stylex";

import "./global.css";

const styles = stylex.create({
	body: {
		WebkitFontSmoothing: "antialiased",
		backgroundColor: colors.background,
		color: colors.text,
		fontFamily:
			'-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", system-ui, sans-serif, "Apple Color Emoji", "Segoe UI Emoji"',
		fontSize: 16,
		lineHeight: 1.5,
	},
	document: {
		colorScheme: "dark",
	},
});

export function Layout({ children }: { children: React.ReactNode }) {
	useEffect(() => {
		// Start CSS hot reloading after hydration so it cannot mutate the SSR link early.
		if (import.meta.env.DEV) {
			void import("virtual:stylex:css-only");
		}
	}, []);

	return (
		<html lang="en" {...stylex.props(styles.document)}>
			<head>
				<meta charSet="utf-8" />
				<meta name="viewport" content="width=device-width, initial-scale=1" />
				<Meta />
				<Links />
				{import.meta.env.DEV && <link rel="stylesheet" href="/virtual:stylex.css" />}
			</head>
			<body {...stylex.props(styles.body)}>
				<main>{children}</main>
				<ScrollRestoration />
				<Scripts />
			</body>
		</html>
	);
}

export async function action() {
	return new Response("Method Not Allowed", { status: 405 });
}

export default function App() {
	return <Outlet />;
}
