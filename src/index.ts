const BASE = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
const BASE_SIZE = BigInt(BASE.length);
const FALLBACK = "https://strinova.gg";

export interface Env {
  URL_SHORTENER: KVNamespace;
}

function b64ToNumber(slug: string): bigint | null {
  if (slug.length === 0) return null;

  let result = 0n;
  for (const char of slug) {
    const idx = BASE.indexOf(char);
    if (idx === -1) return null;
    result = result * BASE_SIZE + BigInt(idx);
  }
  return result;
}

function buildMatchRedirectUrl(matchId: bigint, encodedFromPlayer: string | null): string | null {
  const redirectUrl = new URL(`/match/${matchId}`, FALLBACK);

  if (encodedFromPlayer === null) {
    return redirectUrl.toString();
  }

  const fromPlayerId = b64ToNumber(encodedFromPlayer);
  if (fromPlayerId === null) return null;

  redirectUrl.searchParams.set("fromPlayer", fromPlayerId.toString());
  return redirectUrl.toString();
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const parts = url.pathname.split("/").filter(Boolean);

    if (parts.length < 2) {
      return Response.redirect(FALLBACK, 302);
    }

    const [prefix, ...rest] = parts;
    const slug = rest.join("/");

    if (prefix === "m" || prefix === "p") {
      const id = b64ToNumber(slug);
      if (id === null) return new Response("Bad Request", { status: 400 });

      if (prefix === "m") {
        const redirectUrl = buildMatchRedirectUrl(id, url.searchParams.get("p"));
        if (redirectUrl === null) return new Response("Bad Request", { status: 400 });
        return Response.redirect(redirectUrl, 301);
      }

      return Response.redirect(`${FALLBACK}/player/${id}`, 301);
    }

    if (prefix === "c") {
      return Response.redirect(`${FALLBACK}/creator/${slug}`, 301);
    }

    if (prefix === "cs") {
      const value = await env.URL_SHORTENER.get(slug);
      if (value === null) return Response.redirect(FALLBACK, 302);
      return Response.redirect(`${FALLBACK}/${value}`, 301);
    }

    return Response.redirect(FALLBACK, 302);
  },
} satisfies ExportedHandler<Env>;
