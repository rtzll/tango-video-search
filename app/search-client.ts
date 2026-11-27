import { Data, Effect, Schema } from "effect";

import { SearchQueryError } from "./search-page-data";

class SearchNetworkError extends Data.TaggedError("SearchNetworkError")<{ cause: unknown }> {}
class SearchHttpError extends Data.TaggedError("SearchHttpError")<{ status: number }> {}
class InvalidSearchResponse extends Data.TaggedError("InvalidSearchResponse")<{ cause: unknown }> {}

export function fetchSearch<A>(url: URL, schema: Schema.Codec<A, any>) {
	const request = Effect.gen(function* () {
		const response = yield* Effect.tryPromise({
			try: async (signal) => fetch(url, { signal }),
			catch: (cause) => new SearchNetworkError({ cause }),
		});
		if (!response.ok) {
			void response.body?.cancel().catch(() => undefined);
			return yield* Effect.fail(new SearchHttpError({ status: response.status }));
		}
		const body = yield* Effect.tryPromise({
			try: (): Promise<unknown> => response.json(),
			catch: (cause) =>
				cause instanceof SyntaxError
					? new InvalidSearchResponse({ cause })
					: new SearchNetworkError({ cause }),
		});
		return yield* Schema.decodeUnknownEffect(schema)(body).pipe(
			Effect.mapError((cause) => new InvalidSearchResponse({ cause })),
		);
	});

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
