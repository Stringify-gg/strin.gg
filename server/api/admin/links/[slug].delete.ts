import { defineHandler } from "nitro";
import { getRouterParam } from "nitro/h3";
import { requireAdmin } from "../../../utils/access.ts";
import { fail } from "../../../utils/http.ts";
import { useLinks } from "../../../utils/links.ts";

export default defineHandler(async (event) => {
  await requireAdmin(event);
  const slug = getRouterParam(event, "slug", { decode: true })!;
  const links = useLinks();
  if (!(await links.hasItem(slug))) throw fail(404, "not found");
  await links.removeItem(slug);
  return new Response(null, { status: 204 });
});
