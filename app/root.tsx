import { Theme } from "@radix-ui/themes";
import { Links, Meta, Outlet, Scripts, ScrollRestoration } from "react-router";

import "./tailwind.css";

export function Layout({ children }: { children: React.ReactNode }) {
	return (
		<html lang="en">
			<head>
				<meta charSet="utf-8" />
				<meta name="viewport" content="width=device-width, initial-scale=1" />
				<Meta />
				<Links />
			</head>
			<body>
				<Theme
					accentColor="crimson"
					grayColor="mauve"
					appearance="dark"
					panelBackground="solid"
					radius="none"
				>
					{children}
					<ScrollRestoration />
					<Scripts />
				</Theme>
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
