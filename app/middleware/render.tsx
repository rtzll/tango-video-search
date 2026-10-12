import type { RemixNode } from "remix/component";
import { renderToStream } from "remix/component/server";
import { renderWith } from "remix/middleware/render";
import { createHtmlResponse } from "remix/response/html";

import { SearchControlsEntryId } from "../assets/search-controls.tsx";
import { clientEntryHref } from "../client-entry.ts";

export function render() {
	return renderWith(
		({ request }) =>
			function renderResponse(node: RemixNode, init?: ResponseInit) {
				const stream = renderToStream(node, {
					frameSrc: request.url,
					onError(error) {
						if (!(request.signal.aborted && error === request.signal.reason)) {
							console.error(error);
						}
					},
					async resolveClientEntry(entryId) {
						if (entryId !== SearchControlsEntryId) {
							throw new Error(`Unknown client entry: ${entryId}`);
						}
						return {
							exportName: SearchControlsEntryId,
							href: clientEntryHref,
						};
					},
					signal: request.signal,
				});

				return createHtmlResponse(stream, init);
			},
	);
}
