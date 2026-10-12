import { router } from "../app/router.ts";

export default {
	async fetch(request): Promise<Response> {
		try {
			return await router.fetch(request);
		} catch (error) {
			if (!(request.signal.aborted && error === request.signal.reason)) {
				console.error(
					JSON.stringify({
						error: error instanceof Error ? error.message : String(error),
						message: "Unhandled Tango Video Search request error",
						path: new URL(request.url).pathname,
					}),
				);
			}

			return new Response("Internal Server Error", { status: 500 });
		}
	},
} satisfies ExportedHandler<Env>;
