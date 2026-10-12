import { css, type Handle, type RemixNode } from "remix/component";

import { clientEntryHref } from "../client-entry.ts";
import { colors } from "./colors.ts";

interface DocumentProps {
	children?: RemixNode;
	description?: string;
	title: string;
}

export function Document(handle: Handle<DocumentProps>) {
	return () => {
		const { children, description = "A different way to find tango videos.", title } = handle.props;

		return (
			<html lang="en" mix={htmlStyle}>
				<head>
					<meta charSet="utf-8" />
					<meta name="viewport" content="width=device-width, initial-scale=1" />
					<meta name="description" content={description} />
					<link rel="icon" href="/favicon.ico" />
					<title>{title}</title>
					<style>
						{"@media (scripting: none) { [data-enhanced-search] { display: none !important; } }"}
					</style>
				</head>
				<body mix={bodyStyle}>
					{children}
					<script type="module" src={clientEntryHref}></script>
				</body>
			</html>
		);
	};
}

const htmlStyle = css({
	WebkitFontSmoothing: "antialiased",
	backgroundColor: colors.background,
	colorScheme: "dark",
	minWidth: "320px",
});

const bodyStyle = css({
	"& *, & *::before, & *::after": {
		boxSizing: "border-box",
	},
	"& :where(button, input, select)": {
		font: "inherit",
	},
	backgroundColor: colors.background,
	color: colors.text,
	fontFamily:
		'-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", system-ui, sans-serif, "Apple Color Emoji", "Segoe UI Emoji"',
	fontSize: "16px",
	lineHeight: 1.5,
	margin: 0,
	minHeight: "100dvh",
	minWidth: "320px",
});
