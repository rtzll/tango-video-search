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
				{children}
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
