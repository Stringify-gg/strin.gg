import { HTTPError } from "nitro";

// /m/ and /p/ slugs are base10 IDs in URL-safe base64 (RFC 4648 §5): "B" → 1, "BA" → 64.
const BASE = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
const BASE_SIZE = BigInt(BASE.length);

export function b64ToNumber(slug: string): bigint | null {
  if (slug.length === 0) return null;

  let result = 0n;
  for (const char of slug) {
    const idx = BASE.indexOf(char);
    if (idx === -1) return null;
    result = result * BASE_SIZE + BigInt(idx);
  }
  return result;
}

/** Decodes a base64 ID from the URL, or throws 400. */
export function requireId(slug: string | null | undefined): bigint {
  const id = slug == null ? null : b64ToNumber(slug);
  if (id === null) throw new HTTPError({ status: 400, message: "Bad Request" });
  return id;
}
