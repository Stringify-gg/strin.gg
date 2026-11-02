import { handleAdmin, type AdminEnv } from "./admin";
import { FALLBACK, RESERVED_SLUGS, SLUG_PATTERN, resolveDestination } from "./links";

const BASE = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
const BASE_SIZE = BigInt(BASE.length);

export type Env = AdminEnv;

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

  return new URL(`/share/match/${matchId}/${fromPlayerId}`, FALLBACK).toString();
}

// Stored links can be edited, so they redirect with 302 to keep browsers from caching the old target.
async function redirectToStoredLink(env: Env, key: string): Promise<Response> {
  const value = await env.URL_SHORTENER.get(key);
  const destination = value === null ? null : resolveDestination(value);
  return Response.redirect(destination ?? FALLBACK, 302);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const parts = url.pathname.split("/").filter(Boolean);

    if (parts[0] === "admin") {
      return handleAdmin(request, env, parts.slice(1));
    }

    if (parts.length === 1) {
      const [slug] = parts;
      if (RESERVED_SLUGS.has(slug) || !SLUG_PATTERN.test(slug)) return Response.redirect(FALLBACK, 302);
      return redirectToStoredLink(env, slug);
    }

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

      return Response.redirect(new URL(`/player/${id}`, FALLBACK).toString(), 301);
    }

    if (prefix === "c") {
      return Response.redirect(new URL(`/creators/${slug}`, FALLBACK).toString(), 301);
    }

    if (prefix === "cs") {
      return redirectToStoredLink(env, slug);
    }

    return Response.redirect(FALLBACK, 302);
  },
} satisfies ExportedHandler<Env>;
