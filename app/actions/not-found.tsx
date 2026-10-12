import { css } from "remix/component";

import { routes } from "../routes.ts";
import { colors } from "../ui/colors.ts";

export function NotFoundPage() {
	return () => (
		<main mix={pageStyle}>
			<h1>Not found</h1>
			<p>The page you requested does not exist.</p>
			<a href={routes.home.href()}>Go back home</a>
		</main>
	);
}

const pageStyle = css({
	"& a": {
		color: "inherit",
		display: "inline-block",
		marginTop: "16px",
		textDecoration: "underline",
	},
	"& h1": {
		fontSize: "24px",
		fontWeight: 600,
		lineHeight: "32px",
		margin: 0,
	},
	"& p": {
		color: colors.muted,
		fontSize: "14px",
		lineHeight: "20px",
		margin: "8px 0 0",
	},
	padding: "24px",
});
