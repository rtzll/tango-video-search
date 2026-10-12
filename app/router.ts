import { createRouter, type MiddlewareContext } from "remix/router";

import controller from "./actions/controller.tsx";
import { loadDatabase } from "./middleware/database.ts";
import { render } from "./middleware/render.tsx";
import { routes } from "./routes.ts";

type AppContext = MiddlewareContext<[ReturnType<typeof loadDatabase>, ReturnType<typeof render>]>;

declare module "remix" {
	interface RouterTypes {
		context: AppContext;
	}
}

function createAppRouter() {
	const router = createRouter<AppContext>({
		middleware: [loadDatabase(), render()],
	});

	// Remix owns this method; it is route registration, not Array.prototype.map.
	// eslint-disable-next-line unicorn/no-array-method-this-argument
	router.map(routes, controller);
	return router;
}

export const router = createAppRouter();
