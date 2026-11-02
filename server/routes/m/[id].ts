import { defineHandler } from "nitro";
import { getRouterParam } from "nitro/h3";
import { requireId } from "../../utils/ids.ts";
import { stringifyRedirect } from "../../utils/links.ts";

/** /m/<id> → match page; /m/<id>?p=<player> → that player's share page. */
export default defineHandler((event) => {
  const matchId = requireId(getRouterParam(event, "id"));
  const player = event.url.searchParams.get("p");
  if (player === null) return stringifyRedirect(`/match/${matchId}`);
  return stringifyRedirect(`/share/match/${matchId}/${requireId(player)}`);
});
