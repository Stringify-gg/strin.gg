export const FALLBACK = "https://stringify.gg/";
export const SLUG_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;
export const RESERVED_SLUGS: ReadonlySet<string> = new Set(["m", "p", "c", "cs", "admin"]);

const RANDOM_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
const RANDOM_LENGTH = 7;
const MAX_URL_LENGTH = 2048;

export interface LinkMetadata {
  owner: string;
  createdAt: string;
  updatedBy?: string;
  updatedAt?: string;
}

export interface Link {
  slug: string;
  url: string;
  owner: string | null;
  createdAt: string | null;
  updatedBy: string | null;
  updatedAt: string | null;
}

// Values written by hand before the admin existed are paths relative to stringify.gg; new ones are absolute URLs.
export function resolveDestination(value: string): string | null {
  try {
    return new URL(value, FALLBACK).toString();
  } catch {
    return null;
  }
}

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

export function isCustomSlugAllowed(slug: string): boolean {
  return SLUG_PATTERN.test(slug) && !RESERVED_SLUGS.has(slug);
}

export function randomSlug(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(RANDOM_LENGTH));
  // 256 is a multiple of 64 but not 62; the slight bias is irrelevant for unguessable-enough short links.
  return Array.from(bytes, (b) => RANDOM_ALPHABET[b % RANDOM_ALPHABET.length]).join("");
}

export function toLink(slug: string, url: string, metadata: LinkMetadata | null): Link {
  return {
    slug,
    url: resolveDestination(url) ?? url,
    owner: metadata?.owner ?? null,
    createdAt: metadata?.createdAt ?? null,
    updatedBy: metadata?.updatedBy ?? null,
    updatedAt: metadata?.updatedAt ?? null,
  };
}
