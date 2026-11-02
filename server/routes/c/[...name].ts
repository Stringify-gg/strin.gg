import { defineHandler } from "nitro";
import { getRouterParam } from "nitro/h3";
import { stringifyRedirect } from "../../utils/links.ts";

/** /c/<name> → creator page (the rest of the path is kept, as before). */
export default defineHandler((event) => stringifyRedirect(`/creators/${getRouterParam(event, "name")}`));
