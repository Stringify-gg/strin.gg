import { defineHandler } from "nitro";
import { requireAdmin } from "../../../utils/access.ts";
import { useLinks, type LinkWithSlug } from "../../../utils/links.ts";

/** All links, newest first. */
export default defineHandler(async (event): Promise<LinkWithSlug[]> => {
  await requireAdmin(event);
  const links = useLinks();
  const items = await links.getItems(await links.getKeys());
  return items
    .filter((item) => item.value !== null)
    .map(({ key, value }) => ({ ...value!, slug: key }))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
});
