import { Data, Effect, Schema } from "effect";

import { SearchQueryError } from "./search-page-data";

class SearchNetworkError extends Data.TaggedError("SearchNetworkError")<{ cause: unknown }> {}
class SearchHttpError extends Data.TaggedError("SearchHttpError")<{ status: number }> {}
class InvalidSearchResponse extends Data.TaggedError("InvalidSearchResponse")<{ cause: unknown }> {}

export function fetchSearch<A>(url: URL, schema: Schema.Codec<A, unknown>) {
	const request = Effect.tryPromise({
		try: async (signal): Promise<unknown> => {
			const response = await fetch(url, { signal });
			if (!response.ok) {
				void response.body?.cancel().catch(() => undefined);
				throw new SearchHttpError({ status: response.status });
			}
			return await response.json();
		},
		catch: (cause) => {
			if (cause instanceof SearchHttpError) {
				return cause;
			}
			return cause instanceof SyntaxError
				? new InvalidSearchResponse({ cause })
				: new SearchNetworkError({ cause });
		},
	}).pipe(
		Effect.flatMap((body) =>
			Schema.decodeUnknownEffect(schema)(body).pipe(
				Effect.mapError((cause) => new InvalidSearchResponse({ cause })),
			),
		),
	);

	// One delayed retry keeps the general scheduling machinery out of the browser bundle.
	return request.pipe(
		Effect.catchIf(
			(error) =>
				error._tag === "SearchNetworkError" ||
				(error._tag === "SearchHttpError" && [408, 502, 503, 504].includes(error.status)),
			() => Effect.andThen(Effect.sleep("150 millis"), request),
		),
		Effect.tapErrorTag("InvalidSearchResponse", ({ cause }) =>
			Effect.logError("Invalid search response", { path: url.pathname, cause }),
		),
		Effect.mapError((error) => {
			switch (error._tag) {
				case "SearchNetworkError":
					return new SearchQueryError({ reason: "unavailable" });
				case "SearchHttpError":
					return new SearchQueryError({ reason: "http-error" });
				case "InvalidSearchResponse":
					return new SearchQueryError({ reason: "invalid-response" });
			}
		}),
		Effect.timeoutOrElse({
			duration: "5 seconds",
			orElse: () => Effect.fail(new SearchQueryError({ reason: "timeout" })),
		}),
	);
}
