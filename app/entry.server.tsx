import { isbot } from "isbot";
import { renderToReadableStream } from "react-dom/server";
import type { AppLoadContext, EntryContext } from "react-router";
import { ServerRouter } from "react-router";

const ABORT_DELAY = 5_000;

export default async function handleRequest(
	request: Request,
	responseStatusCode: number,
	responseHeaders: Headers,
	reactRouterContext: EntryContext,
	// This is ignored so we can keep it in the template for visibility.  Feel
	// free to delete this parameter in your app if you're not using it!
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	_loadContext: AppLoadContext,
) {
	let statusCode = responseStatusCode;
	const controller = new AbortController();
	const timeoutId = setTimeout(() => controller.abort(), ABORT_DELAY);

	try {
		const stream = await renderToReadableStream(
			<ServerRouter context={reactRouterContext} url={request.url} />,
			{
				signal: controller.signal,
				onError(error: unknown) {
					const isNotFound = error instanceof Response && error.status === 404;
					const message =
						error instanceof Error ? error.message : String(error);
					if (isNotFound || message.includes("No route matches URL")) {
						return;
					}
					statusCode = 500;
					console.error(error);
				},
			},
		);

		if (isbot(request.headers.get("user-agent") || "")) {
			await stream.allReady;
		}

		responseHeaders.set("Content-Type", "text/html");
		return new Response(stream, {
			headers: responseHeaders,
			status: statusCode,
		});
	} finally {
		clearTimeout(timeoutId);
	}
}
