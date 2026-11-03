import { defineHandler } from "nitro";
import { getRouterParam } from "nitro/h3";
import { storedLinkRedirect } from "../utils/links.ts";

/** /<slug> → stored destination. */
export default defineHandler((event) => storedLinkRedirect(getRouterParam(event, "slug", { decode: true })));
