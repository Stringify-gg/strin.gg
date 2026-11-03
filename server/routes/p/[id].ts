import { defineHandler } from "nitro";
import { getRouterParam } from "nitro/h3";
import { requireId } from "../../utils/ids.ts";
import { stringifyRedirect } from "../../utils/links.ts";

/** /p/<id> → player page. */
export default defineHandler((event) => stringifyRedirect(`/player/${requireId(getRouterParam(event, "id"))}`));
