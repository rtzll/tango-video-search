import { Effect, Fiber, Schema } from "effect";
import { TestClock } from "effect/testing";
import { afterEach, expect, it, vi } from "vite-plus/test";

import { fetchSearch } from "./search-client";

const url = new URL("https://example.com/api/search");
const payload = { total: 2 };
const search = fetchSearch(url, Schema.Struct({ total: Schema.Number }));

afterEach(() => vi.unstubAllGlobals());

it("retries a transient response once after 150 milliseconds", async () => {
	const fetch = vi
		.fn()
		.mockResolvedValueOnce(new Response(null, { status: 503 }))
		.mockResolvedValueOnce(Response.json(payload));
	vi.stubGlobal("fetch", fetch);

	const result = await Effect.runPromise(
		Effect.gen(function* () {
			const request = yield* Effect.forkChild(search, { startImmediately: true });
			yield* TestClock.adjust(149);
			expect(fetch).toHaveBeenCalledTimes(1);
			yield* TestClock.adjust(1);
			return yield* Fiber.join(request);
		}).pipe(Effect.provide(TestClock.layer())),
	);
	expect(result).toEqual(payload);
	expect(fetch).toHaveBeenCalledTimes(2);
});

it("stops after one retry when the network stays unavailable", async () => {
	const fetch = vi.fn().mockRejectedValue(new TypeError("Network connection lost"));
	vi.stubGlobal("fetch", fetch);

	await expect(Effect.runPromise(search)).rejects.toMatchObject({ reason: "unavailable" });
	expect(fetch).toHaveBeenCalledTimes(2);
});

it.each([
	["a permanent HTTP error", () => new Response(null, { status: 404 }), "http-error"],
	["malformed JSON", () => new Response("{!"), "invalid-response"],
	["a schema mismatch", () => Response.json({ total: "wrong" }), "invalid-response"],
] as const)("does not retry %s", async (_name, response, reason) => {
	const fetch = vi.fn().mockImplementation(response);
	vi.stubGlobal("fetch", fetch);

	await expect(Effect.runPromise(search)).rejects.toMatchObject({ reason });
	expect(fetch).toHaveBeenCalledTimes(1);
});

it("aborts a pending fetch when the total deadline expires", async () => {
	let requestSignal: AbortSignal | null | undefined;
	vi.stubGlobal("fetch", (_input: URL, { signal }: RequestInit) => {
		requestSignal = signal;
		return new Promise<Response>(() => {});
	});

	const result = await Effect.runPromise(
		Effect.gen(function* () {
			const request = yield* Effect.forkChild(Effect.result(search), { startImmediately: true });
			yield* TestClock.adjust("5 seconds");
			return yield* Fiber.join(request);
		}).pipe(Effect.provide(TestClock.layer())),
	);
	expect(result).toMatchObject({ _tag: "Failure", failure: { reason: "timeout" } });
	expect(requestSignal?.aborted).toBe(true);
});
