import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from "jose";

export interface AccessEnv {
  ACCESS_TEAM_DOMAIN?: string;
  ACCESS_AUD?: string;
  DEV_ADMIN_EMAIL?: string;
}

export type Identity = { email: string } | { error: "not_configured" | "unauthenticated" };

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
export async function identify(request: Request, env: AccessEnv): Promise<Identity> {
  const teamDomain = env.ACCESS_TEAM_DOMAIN?.trim();
  const audience = env.ACCESS_AUD?.trim();

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

  const devEmail = env.DEV_ADMIN_EMAIL?.trim();
  if (devEmail && isLocalhost(new URL(request.url).hostname)) return { email: devEmail.toLowerCase() };

  return { error: "not_configured" };
}
