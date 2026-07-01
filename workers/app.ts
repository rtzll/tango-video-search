import { RouterContextProvider, createRequestHandler } from "react-router";

import { cloudflareContext, type AppEnv } from "../app/context.server";

const requestHandler = createRequestHandler(
	() => import("virtual:react-router/server-build"),
	import.meta.env.MODE,
);

export default {
	async fetch(request, env, ctx) {
		const routerContext = new RouterContextProvider();
		routerContext.set(cloudflareContext, {
			cf: request.cf,
			ctx,
			env,
		});

		return requestHandler(request, routerContext);
	},
} satisfies ExportedHandler<AppEnv>;
