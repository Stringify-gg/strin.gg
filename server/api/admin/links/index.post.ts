import { defineHandler } from "nitro";
import { requireAdmin } from "../../../utils/access.ts";
import { fail, readJsonObject } from "../../../utils/http.ts";
import { isSlug, randomSlug, useLinks, validateDestination, type Link, type LinkWithSlug } from "../../../utils/links.ts";

const RANDOM_ATTEMPTS = 5;

/** Creates `{ url, slug? }`; a random 7-character slug when `slug` is omitted. */
export default defineHandler(async (event): Promise<LinkWithSlug> => {
  const email = await requireAdmin(event);
  const body = await readJsonObject(event);
  const url = validateDestination(body.url);
  if (url === null) throw fail(400, "url must be an absolute http(s) URL");

  const links = useLinks();
  let slug: string;
  if (body.slug !== undefined && body.slug !== null && body.slug !== "") {
    if (typeof body.slug !== "string" || !isSlug(body.slug)) {
      throw fail(400, "slug must be 1-64 of A-Z a-z 0-9 _ - and not reserved");
    }
    slug = body.slug;
    if (await links.hasItem(slug)) throw fail(409, "slug already exists");
  } else {
    let found: string | null = null;
    for (let i = 0; i < RANDOM_ATTEMPTS && found === null; i++) {
      const candidate = randomSlug();
      if (!(await links.hasItem(candidate))) found = candidate;
    }
    if (found === null) throw fail(503, "could not allocate a slug");
    slug = found;
  }

  const link: Link = { url, owner: email, createdAt: new Date().toISOString() };
  await links.setItem(slug, link);
  event.res.status = 201;
  return { ...link, slug };
});
