import { defineHandler } from "nitro";
import { getRouterParam } from "nitro/h3";
import { storedLinkRedirect } from "../../utils/links.ts";

/** /cs/<slug> → stored destination (older form of /<slug>). */
export default defineHandler((event) => storedLinkRedirect(getRouterParam(event, "slug", { decode: true })));
