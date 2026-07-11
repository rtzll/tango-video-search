import { Link } from "react-router";

function NotFoundContent() {
	return (
		<div className="p-6">
			<h1 className="text-2xl font-semibold">Not found</h1>
			<p className="text-muted mt-2 text-sm">
				The page you requested does not exist.
			</p>
			<Link className="mt-4 inline-block underline" to="/">
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
