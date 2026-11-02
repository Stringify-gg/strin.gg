import { identify, type AccessEnv } from "./access";
import { ADMIN_PAGE } from "./admin-page";
import {
  isCustomSlugAllowed,
  randomSlug,
  toLink,
  validateDestination,
  type Link,
  type LinkMetadata,
} from "./links";

export interface AdminEnv extends AccessEnv {
  URL_SHORTENER: KVNamespace;
}

const LIST_PAGE_SIZE = 100;
const RANDOM_ATTEMPTS = 5;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}

function error(status: number, message: string): Response {
  return json({ error: message }, status);
}

function page(): Response {
  return new Response(ADMIN_PAGE, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
      "content-security-policy":
        "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'",
      "referrer-policy": "no-referrer",
      "x-content-type-options": "nosniff",
    },
  });
}

// The Access cookie rides along on cross-site requests, so writes must be JSON from our own origin.
function rejectCrossSite(request: Request): Response | null {
  const origin = request.headers.get("origin");
  if (origin !== null && origin !== new URL(request.url).origin) return error(403, "cross-origin request");
  if (request.method === "DELETE") return null;
  const type = request.headers.get("content-type") ?? "";
  if (!type.toLowerCase().startsWith("application/json")) return error(415, "expected application/json");
  return null;
}

async function readBody(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const body = await request.json();
    return body !== null && typeof body === "object" && !Array.isArray(body) ? (body as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

async function listLinks(env: AdminEnv, cursor: string | null): Promise<Response> {
  const page = await env.URL_SHORTENER.list<LinkMetadata>({ limit: LIST_PAGE_SIZE, cursor: cursor ?? undefined });
  const links = await Promise.all(
    page.keys.map(async (key): Promise<Link | null> => {
      const value = await env.URL_SHORTENER.get(key.name);
      return value === null ? null : toLink(key.name, value, key.metadata ?? null);
    }),
  );
  return json({
    links: links.filter((link): link is Link => link !== null),
    cursor: page.list_complete ? null : page.cursor,
  });
}

async function createLink(request: Request, env: AdminEnv, email: string): Promise<Response> {
  const body = await readBody(request);
  if (body === null) return error(400, "invalid JSON body");
  const url = validateDestination(body.url);
  if (url === null) return error(400, "url must be an absolute http(s) URL");

  let slug: string;
  if (body.slug !== undefined && body.slug !== null && body.slug !== "") {
    if (typeof body.slug !== "string" || !isCustomSlugAllowed(body.slug)) {
      return error(400, "slug must be 1-64 of A-Z a-z 0-9 _ - and not reserved");
    }
    slug = body.slug;
    if ((await env.URL_SHORTENER.get(slug)) !== null) return error(409, "slug already exists");
  } else {
    let found: string | null = null;
    for (let i = 0; i < RANDOM_ATTEMPTS && found === null; i++) {
      const candidate = randomSlug();
      if ((await env.URL_SHORTENER.get(candidate)) === null) found = candidate;
    }
    if (found === null) return error(503, "could not allocate a slug");
    slug = found;
  }

  const metadata: LinkMetadata = { owner: email, createdAt: new Date().toISOString() };
  await env.URL_SHORTENER.put(slug, url, { metadata });
  return json(toLink(slug, url, metadata), 201);
}

async function updateLink(request: Request, env: AdminEnv, email: string, slug: string): Promise<Response> {
  const existing = await env.URL_SHORTENER.getWithMetadata<LinkMetadata>(slug);
  if (existing.value === null) return error(404, "not found");
  const body = await readBody(request);
  if (body === null) return error(400, "invalid JSON body");
  const url = validateDestination(body.url);
  if (url === null) return error(400, "url must be an absolute http(s) URL");

  const metadata: LinkMetadata = {
    owner: existing.metadata?.owner ?? email,
    createdAt: existing.metadata?.createdAt ?? new Date().toISOString(),
    updatedBy: email,
    updatedAt: new Date().toISOString(),
  };
  await env.URL_SHORTENER.put(slug, url, { metadata });
  return json(toLink(slug, url, metadata));
}

async function deleteLink(env: AdminEnv, slug: string): Promise<Response> {
  if ((await env.URL_SHORTENER.get(slug)) === null) return error(404, "not found");
  await env.URL_SHORTENER.delete(slug);
  return new Response(null, { status: 204 });
}

// parts excludes the leading "admin" segment.
export async function handleAdmin(request: Request, env: AdminEnv, parts: string[]): Promise<Response> {
  const identity = await identify(request, env);
  if ("error" in identity) {
    return identity.error === "not_configured" ? error(503, "admin is not configured") : error(403, "forbidden");
  }

  if (parts.length === 0) {
    return request.method === "GET" || request.method === "HEAD" ? page() : error(405, "method not allowed");
  }

  if (parts[0] !== "api" || parts[1] !== "links") return error(404, "not found");

  if (parts.length === 2) {
    if (request.method === "GET") return listLinks(env, new URL(request.url).searchParams.get("cursor"));
    if (request.method === "POST") return rejectCrossSite(request) ?? createLink(request, env, identity.email);
    return error(405, "method not allowed");
  }

  // Legacy /cs keys may contain "/", so the remainder of the path is the key.
  let slug: string;
  try {
    slug = parts.slice(2).map(decodeURIComponent).join("/");
  } catch {
    return error(400, "invalid slug");
  }
  if (request.method === "PUT") return rejectCrossSite(request) ?? updateLink(request, env, identity.email, slug);
  if (request.method === "DELETE") return rejectCrossSite(request) ?? deleteLink(env, slug);
  return error(405, "method not allowed");
}
