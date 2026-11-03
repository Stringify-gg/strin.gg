import { defineHandler } from "nitro";
import { getRouterParam } from "nitro/h3";
import { requireAdmin } from "../../../utils/access.ts";
import { fail, readJsonObject } from "../../../utils/http.ts";
import { useLinks, validateDestination, type Link, type LinkWithSlug } from "../../../utils/links.ts";

/** Changes the destination: `{ url }`. */
export default defineHandler(async (event): Promise<LinkWithSlug> => {
  const email = await requireAdmin(event);
  const slug = getRouterParam(event, "slug", { decode: true })!;
  const links = useLinks();
  const existing = await links.getItem(slug);
  if (existing === null) throw fail(404, "not found");

  const body = await readJsonObject(event);
  const url = validateDestination(body.url);
  if (url === null) throw fail(400, "url must be an absolute http(s) URL");

  const link: Link = { ...existing, url, updatedBy: email, updatedAt: new Date().toISOString() };
  await links.setItem(slug, link);
  return { ...link, slug };
});
