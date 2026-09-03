import * as stylex from "@stylexjs/stylex";
import { Link } from "react-router";

import { colors } from "../styles/tokens.stylex";

function NotFoundContent() {
	return (
		<div {...stylex.props(styles.page)}>
			<h1 {...stylex.props(styles.heading)}>Not found</h1>
			<p {...stylex.props(styles.message)}>The page you requested does not exist.</p>
			<Link {...stylex.props(styles.homeLink)} to="/">
				Go back home
			</Link>
		</div>
	);
}

export default function NotFound() {
	return <NotFoundContent />;
}

export function loader() {
	throw new Response("Not Found", { status: 404 });
}

export function ErrorBoundary() {
	return <NotFoundContent />;
}

const styles = stylex.create({
	heading: { fontSize: "1.5rem", fontWeight: 600, lineHeight: "2rem" },
	homeLink: { display: "inline-block", marginTop: "1rem", textDecorationLine: "underline" },
	message: {
		color: colors.muted,
		fontSize: "0.875rem",
		lineHeight: "1.25rem",
		marginTop: "0.5rem",
	},
	page: { padding: "1.5rem" },
});
