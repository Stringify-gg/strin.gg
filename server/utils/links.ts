import { useTypedKV } from "./kv.ts";

export const FALLBACK = "https://stringify.gg/";
export const SLUG_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;
/** First path segments the server routes itself, so they can't be slugs. */
export const RESERVED_SLUGS: ReadonlySet<string> = new Set(["m", "p", "c", "cs", "admin", "api", "assets"]);

const RANDOM_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
const RANDOM_LENGTH = 7;
const MAX_URL_LENGTH = 2048;

export interface Link {
  /** Absolute http(s) destination. */
  url: string;
  owner: string;
  createdAt: string;
  updatedBy?: string;
  updatedAt?: string;
}

/** A link as the admin API returns it. */
export interface LinkWithSlug extends Link {
  slug: string;
}

/** Short links, keyed by slug. */
export const useLinks = () => useTypedKV<Link>("url_shortener", "links");

export function validateDestination(input: unknown): string | null {
  if (typeof input !== "string" || input.length > MAX_URL_LENGTH) return null;
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  return url.toString();
}

export function isSlug(slug: string): boolean {
  return SLUG_PATTERN.test(slug) && !RESERVED_SLUGS.has(slug);
}

export function randomSlug(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(RANDOM_LENGTH));
  // 256 is a multiple of 64 but not 62; the slight bias is irrelevant for unguessable-enough short links.
  return Array.from(bytes, (b) => RANDOM_ALPHABET[b % RANDOM_ALPHABET.length]).join("");
}

export const fallbackRedirect = () => Response.redirect(FALLBACK, 302);

/** A permanent redirect to a path on stringify.gg. */
export const stringifyRedirect = (path: string) => Response.redirect(new URL(path, FALLBACK).toString(), 301);

// Stored links can be edited, so they redirect with 302 to keep browsers from caching the old target.
export async function storedLinkRedirect(slug: string | undefined): Promise<Response> {
  const link = slug && isSlug(slug) ? await useLinks().getItem(slug) : null;
  return Response.redirect(link?.url ?? FALLBACK, 302);
}
