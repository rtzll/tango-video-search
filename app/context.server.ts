import { createContext, type RouterContextProvider } from "react-router";

export interface AppEnv {
	DB: D1Database;
	ASSETS: Fetcher;
}

interface CloudflareRuntime {
	cf?: IncomingRequestCfProperties;
	ctx: ExecutionContext;
	env: AppEnv;
}

export const cloudflareContext = createContext<CloudflareRuntime>();

export function getCloudflareRuntime(context: Readonly<RouterContextProvider>) {
	return context.get(cloudflareContext);
}
