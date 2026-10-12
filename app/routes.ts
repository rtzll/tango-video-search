import { get, head, route } from "remix/routes";

export const routes = route({
	home: get("/"),
	homeHead: head("/"),
	notFound: get("/*path"),
	notFoundHead: head("/*path"),
});
