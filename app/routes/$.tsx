import { Text } from "@radix-ui/themes";
import { Link } from "react-router";

export default function NotFound() {
	return (
		<div className="p-6">
			<h1 className="text-2xl font-semibold">Not found</h1>
			<Text size="2" color="gray" className="mt-2">
				The page you requested does not exist.
			</Text>
			<Link className="mt-4 inline-block underline" to="/">
				Go back home
			</Link>
		</div>
	);
}

export function loader() {
	throw new Response("Not Found", { status: 404 });
}

export function ErrorBoundary() {
	return (
		<div className="p-6">
			<h1 className="text-2xl font-semibold">Not found</h1>
			<Text size="2" color="gray" className="mt-2">
				The page you requested does not exist.
			</Text>
			<Link className="mt-4 inline-block underline" to="/">
				Go back home
			</Link>
		</div>
	);
}
