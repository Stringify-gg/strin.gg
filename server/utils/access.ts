import { env } from "cloudflare:workers";
import { HTTPError } from "nitro";
import type { H3Event } from "nitro/h3";
import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from "jose";

// DEV_ADMIN_EMAIL only exists in .dev.vars, so it may be missing from the generated Env.
interface AccessEnv {
  ACCESS_TEAM_DOMAIN?: string;
  ACCESS_AUD?: string;
  DEV_ADMIN_EMAIL?: string;
}

type RequestLike = Pick<Request, "headers" | "method" | "url">;
type Identity = { email: string } | { error: "not_configured" | "unauthenticated" };

const keySets = new Map<string, JWTVerifyGetKey>();

function keySet(teamDomain: string): JWTVerifyGetKey {
  let keys = keySets.get(teamDomain);
  if (!keys) {
    keys = createRemoteJWKSet(new URL(`https://${teamDomain}/cdn-cgi/access/certs`));
    keySets.set(teamDomain, keys);
  }
  return keys;
}

function isLocalhost(hostname: string): boolean {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]";
}

// Cloudflare Access guards /admin at the edge; the Worker verifies the assertion again so a missing
// or misrouted Access application never exposes link management.
async function identify(request: RequestLike): Promise<Identity> {
  const { ACCESS_TEAM_DOMAIN, ACCESS_AUD, DEV_ADMIN_EMAIL } = env as AccessEnv;
  const teamDomain = ACCESS_TEAM_DOMAIN?.trim();
  const audience = ACCESS_AUD?.trim();

  if (teamDomain && audience) {
    const assertion = request.headers.get("cf-access-jwt-assertion");
    if (!assertion) return { error: "unauthenticated" };
    try {
      const { payload } = await jwtVerify(assertion, keySet(teamDomain), {
        issuer: `https://${teamDomain}`,
        audience,
        algorithms: ["RS256"],
      });
      if (typeof payload.email !== "string" || !payload.email) return { error: "unauthenticated" };
      return { email: payload.email.trim().toLowerCase() };
    } catch (err) {
      console.warn("admin: access assertion rejected", { reason: (err as Error).name });
      return { error: "unauthenticated" };
    }
  }

  const devEmail = DEV_ADMIN_EMAIL?.trim();
  if (devEmail && isLocalhost(new URL(request.url).hostname)) return { email: devEmail.toLowerCase() };

  return { error: "not_configured" };
}

// The Access cookie rides along on cross-site requests, so writes must be JSON from our own origin.
function rejectCrossSite(request: RequestLike): void {
  const origin = request.headers.get("origin");
  if (origin !== null && origin !== new URL(request.url).origin) {
    throw new HTTPError({ status: 403, message: "cross-origin request" });
  }
  if (request.method === "GET" || request.method === "HEAD" || request.method === "DELETE") return;
  const type = request.headers.get("content-type") ?? "";
  if (!type.toLowerCase().startsWith("application/json")) {
    throw new HTTPError({ status: 415, message: "expected application/json" });
  }
}

/** Returns the signed-in staff email, or throws 503/403. Writes must also be same-origin JSON. */
export async function requireAdmin(event: H3Event): Promise<string> {
  const identity = await identify(event.req);
  if ("error" in identity) {
    throw identity.error === "not_configured"
      ? new HTTPError({ status: 503, message: "admin is not configured" })
      : new HTTPError({ status: 403, message: "forbidden" });
  }
  rejectCrossSite(event.req);
  return identity.email;
}
