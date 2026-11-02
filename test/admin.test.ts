import { afterEach, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { SignJWT, exportJWK, generateKeyPair, type CryptoKey } from "jose";
import worker, { type Env } from "../src/index";
import { MemoryKV } from "./memory-kv";

let kv: MemoryKV;
const realFetch = globalThis.fetch;

beforeEach(() => {
  kv = new MemoryKV();
});

afterEach(() => {
  globalThis.fetch = realFetch;
});

function call(env: Env, path: string, init?: RequestInit & { origin?: string }): Promise<Response> {
  const origin = init?.origin ?? "http://localhost:8787";
  return worker.fetch(new Request(`${origin}${path}`, init), env);
}

function devEnv(): Env {
  return { URL_SHORTENER: kv as unknown as KVNamespace, DEV_ADMIN_EMAIL: "Staff@Stringify.gg" };
}

function post(body: unknown, headers: Record<string, string> = {}): RequestInit {
  return { method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(body) };
}

describe("admin auth", () => {
  test("is closed when Access is not configured", async () => {
    const res = await call({ URL_SHORTENER: kv as unknown as KVNamespace }, "/admin");
    expect(res.status).toBe(503);
  });

  test("dev email only applies on localhost", async () => {
    expect((await call(devEnv(), "/admin")).status).toBe(200);
    expect((await call(devEnv(), "/admin", { origin: "https://strin.gg" })).status).toBe(503);
  });

  describe("with Cloudflare Access", () => {
    const teamDomain = "team.cloudflareaccess.com";
    const audience = "aud-tag";
    let privateKey: CryptoKey;
    let otherKey: CryptoKey;
    let jwks: unknown;

    beforeAll(async () => {
      const pair = await generateKeyPair("RS256");
      privateKey = pair.privateKey;
      otherKey = (await generateKeyPair("RS256")).privateKey;
      jwks = { keys: [{ ...(await exportJWK(pair.publicKey)), kid: "k1", alg: "RS256", use: "sig" }] };
    });

    beforeEach(() => {
      globalThis.fetch = (async (input: RequestInfo | URL) => {
        const url = input instanceof Request ? input.url : String(input);
        if (url !== `https://${teamDomain}/cdn-cgi/access/certs`) throw new Error(`unexpected fetch ${url}`);
        return Response.json(jwks);
      }) as typeof fetch;
    });

    function accessEnv(): Env {
      // DEV_ADMIN_EMAIL must be ignored once Access is configured.
      return { ...devEnv(), ACCESS_TEAM_DOMAIN: teamDomain, ACCESS_AUD: audience };
    }

    function token(claims: { aud?: string; iss?: string; email?: string }, key = privateKey) {
      return new SignJWT({ email: claims.email ?? "ed@stringify.gg" })
        .setProtectedHeader({ alg: "RS256", kid: "k1" })
        .setIssuer(claims.iss ?? `https://${teamDomain}`)
        .setAudience(claims.aud ?? audience)
        .setIssuedAt()
        .setExpirationTime("5m")
        .sign(key);
    }

    async function withToken(jwt: string, init: RequestInit = {}): Promise<Response> {
      const headers = new Headers(init.headers);
      headers.set("cf-access-jwt-assertion", jwt);
      return call(accessEnv(), "/admin/api/links", { ...init, origin: "https://strin.gg", headers });
    }

    test("accepts a valid assertion and records its email as owner", async () => {
      const res = await withToken(await token({}), post({ url: "https://example.com/" }));
      expect(res.status).toBe(201);
      expect((await res.json()).owner).toBe("ed@stringify.gg");
    });

    test("rejects missing, mis-addressed or forged assertions", async () => {
      expect((await call(accessEnv(), "/admin", { origin: "http://localhost:8787" })).status).toBe(403);
      expect((await withToken(await token({ aud: "other" }))).status).toBe(403);
      expect((await withToken(await token({ iss: "https://evil.cloudflareaccess.com" }))).status).toBe(403);
      expect((await withToken(await token({}, otherKey))).status).toBe(403);
      expect((await withToken("not.a.jwt")).status).toBe(403);
    });
  });
});

describe("admin links API", () => {
  test("creates a custom slug that then redirects", async () => {
    const res = await call(devEnv(), "/admin/api/links", post({ url: "https://docs.google.com/forms/x", slug: "signup" }));
    expect(res.status).toBe(201);
    const link = await res.json();
    expect(link).toMatchObject({ slug: "signup", url: "https://docs.google.com/forms/x", owner: "staff@stringify.gg" });

    const redirect = await worker.fetch(new Request("https://strin.gg/signup"), devEnv());
    expect(redirect.status).toBe(302);
    expect(redirect.headers.get("location")).toBe("https://docs.google.com/forms/x");
  });

  test("generates a slug when none is given", async () => {
    const res = await call(devEnv(), "/admin/api/links", post({ url: "https://example.com/a" }));
    expect(res.status).toBe(201);
    expect((await res.json()).slug).toMatch(/^[A-Za-z0-9]{7}$/);
  });

  test("validates input", async () => {
    await kv.put("taken", "tournaments/1");
    const cases: [unknown, number][] = [
      [{ url: "https://example.com/", slug: "taken" }, 409],
      [{ url: "https://example.com/", slug: "admin" }, 400],
      [{ url: "https://example.com/", slug: "cs" }, 400],
      [{ url: "https://example.com/", slug: "has/slash" }, 400],
      [{ url: "javascript:alert(1)" }, 400],
      [{ url: "/relative" }, 400],
      [{}, 400],
      [[], 400],
    ];
    for (const [body, status] of cases) {
      expect((await call(devEnv(), "/admin/api/links", post(body))).status).toBe(status);
    }
  });

  test("rejects cross-site writes", async () => {
    expect((await call(devEnv(), "/admin/api/links", post({ url: "https://example.com/" }, { origin: "https://evil.example" }))).status).toBe(403);
    const form = { method: "POST", headers: { "content-type": "text/plain" }, body: JSON.stringify({ url: "https://example.com/" }) };
    expect((await call(devEnv(), "/admin/api/links", form)).status).toBe(415);
    expect(kv.entries.size).toBe(0);
  });

  test("lists, updates and deletes links, including legacy keys", async () => {
    await kv.put("spring/finals", "tournaments/123");
    await call(devEnv(), "/admin/api/links", post({ url: "https://example.com/", slug: "ex" }));

    const list = await (await call(devEnv(), "/admin/api/links")).json();
    expect(list.cursor).toBeNull();
    expect(list.links.map((l: { slug: string; url: string }) => [l.slug, l.url])).toEqual([
      ["ex", "https://example.com/"],
      ["spring/finals", "https://stringify.gg/tournaments/123"],
    ]);

    const put = { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ url: "https://example.com/new" }) };
    const updated = await (await call(devEnv(), "/admin/api/links/spring%2Ffinals", put)).json();
    expect(updated).toMatchObject({ url: "https://example.com/new", updatedBy: "staff@stringify.gg" });
    expect(await kv.get("spring/finals")).toBe("https://example.com/new");

    expect((await call(devEnv(), "/admin/api/links/ex", { method: "DELETE" })).status).toBe(204);
    expect((await call(devEnv(), "/admin/api/links/ex", { method: "DELETE" })).status).toBe(404);
    expect(await kv.get("ex")).toBeNull();
  });

  test("pages through long lists", async () => {
    for (let i = 0; i < 150; i++) await kv.put(`k${String(i).padStart(3, "0")}`, "https://example.com/");
    const first = await (await call(devEnv(), "/admin/api/links")).json();
    expect(first.links).toHaveLength(100);
    const second = await (await call(devEnv(), `/admin/api/links?cursor=${first.cursor}`)).json();
    expect(second.links).toHaveLength(50);
    expect(second.cursor).toBeNull();
  });
});
