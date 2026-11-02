import { beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import { SignJWT, exportJWK, generateKeyPair, type CryptoKey } from "jose";
import { bodyOf, call, postJson, resetTestEnv, testEnv } from "./env.ts";

const LINKS = "/api/admin/links";
const json = (method: string, body: unknown): RequestInit => ({
  method,
  headers: { "content-type": "application/json" },
  body: JSON.stringify(body),
});

const storedLink = (slug: string) => {
  const raw = testEnv.URL_SHORTENER.entries.get(`links:${slug}`);
  return raw === undefined ? null : JSON.parse(raw);
};

describe("admin auth", () => {
  test("is closed when Access is not configured", async () => {
    expect((await call(LINKS)).status).toBe(503);
    expect((await call("/admin")).status).toBe(503);
  });

  test("dev email only applies on localhost", async () => {
    resetTestEnv({ DEV_ADMIN_EMAIL: "Staff@Stringify.gg" });
    expect((await call(LINKS)).status).toBe(200);
    expect((await call(`https://strin.gg${LINKS}`)).status).toBe(503);
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
      // DEV_ADMIN_EMAIL must be ignored once Access is configured.
      resetTestEnv({ ACCESS_TEAM_DOMAIN: teamDomain, ACCESS_AUD: audience, DEV_ADMIN_EMAIL: "staff@stringify.gg" });
      vi.stubGlobal("fetch", async (input: RequestInfo | URL) => {
        const url = input instanceof Request ? input.url : String(input);
        if (url !== `https://${teamDomain}/cdn-cgi/access/certs`) throw new Error(`unexpected fetch ${url}`);
        return Response.json(jwks);
      });
    });

    function token(claims: { aud?: string; iss?: string; email?: string }, key = privateKey) {
      return new SignJWT({ email: claims.email ?? "Ed@Stringify.gg" })
        .setProtectedHeader({ alg: "RS256", kid: "k1" })
        .setIssuer(claims.iss ?? `https://${teamDomain}`)
        .setAudience(claims.aud ?? audience)
        .setIssuedAt()
        .setExpirationTime("5m")
        .sign(key);
    }

    function withToken(jwt: string, init: RequestInit = {}) {
      const headers = new Headers(init.headers);
      headers.set("cf-access-jwt-assertion", jwt);
      return call(`https://strin.gg${LINKS}`, { ...init, headers });
    }

    test("accepts a valid assertion and records its email as owner", async () => {
      const res = await withToken(await token({}), postJson({ url: "https://example.com/" }));
      expect(res.status).toBe(201);
      expect((await bodyOf(res)).owner).toBe("ed@stringify.gg");
    });

    test("rejects missing, mis-addressed or forged assertions", async () => {
      expect((await call("/admin")).status).toBe(403);
      expect((await call(LINKS)).status).toBe(403);
      expect((await withToken(await token({ aud: "other" }))).status).toBe(403);
      expect((await withToken(await token({ iss: "https://evil.cloudflareaccess.com" }))).status).toBe(403);
      expect((await withToken(await token({}, otherKey))).status).toBe(403);
      expect((await withToken("not.a.jwt")).status).toBe(403);
    });
  });
});

describe("admin links API", () => {
  beforeEach(() => resetTestEnv({ DEV_ADMIN_EMAIL: "Staff@Stringify.gg" }));

  test("creates a custom slug that then redirects", async () => {
    const res = await call(LINKS, postJson({ url: "https://docs.google.com/forms/x", slug: "signup" }));
    expect(res.status).toBe(201);
    expect(await bodyOf(res)).toMatchObject({
      slug: "signup",
      url: "https://docs.google.com/forms/x",
      owner: "staff@stringify.gg",
    });
    expect(storedLink("signup")).toMatchObject({ url: "https://docs.google.com/forms/x" });

    const redirect = await call("https://strin.gg/signup");
    expect(redirect.status).toBe(302);
    expect(redirect.headers.get("location")).toBe("https://docs.google.com/forms/x");
  });

  test("generates a slug when none is given", async () => {
    const res = await call(LINKS, postJson({ url: "https://example.com/a" }));
    expect(res.status).toBe(201);
    expect((await bodyOf(res)).slug).toMatch(/^[A-Za-z0-9]{7}$/);
  });

  test("validates input", async () => {
    await call(LINKS, postJson({ url: "https://example.com/", slug: "taken" }));
    const cases: [unknown, number][] = [
      [{ url: "https://example.com/", slug: "taken" }, 409],
      [{ url: "https://example.com/", slug: "admin" }, 400],
      [{ url: "https://example.com/", slug: "api" }, 400],
      [{ url: "https://example.com/", slug: "cs" }, 400],
      [{ url: "https://example.com/", slug: "has/slash" }, 400],
      [{ url: "https://example.com/", slug: "x".repeat(65) }, 400],
      [{ url: "javascript:alert(1)" }, 400],
      [{ url: "/relative" }, 400],
      [{}, 400],
      [[], 400],
    ];
    for (const [body, status] of cases) {
      expect((await call(LINKS, postJson(body))).status, JSON.stringify(body)).toBe(status);
    }
    expect((await call(LINKS, { method: "POST", headers: { "content-type": "application/json" }, body: "{" })).status).toBe(400);
  });

  test("rejects cross-site writes", async () => {
    const crossSite = postJson({ url: "https://example.com/" }, { origin: "https://evil.example" });
    expect((await call(LINKS, crossSite)).status).toBe(403);
    const form = { method: "POST", headers: { "content-type": "text/plain" }, body: JSON.stringify({ url: "https://example.com/" }) };
    expect((await call(LINKS, form)).status).toBe(415);
    expect(testEnv.URL_SHORTENER.entries.size).toBe(0);
  });

  test("lists newest first, updates and deletes links", async () => {
    await call(LINKS, postJson({ url: "https://example.com/1", slug: "first" }));
    await new Promise((resolve) => setTimeout(resolve, 5));
    await call(LINKS, postJson({ url: "https://example.com/2", slug: "second" }));

    const list = await bodyOf(await call(LINKS));
    expect(list.map((l: { slug: string; url: string }) => [l.slug, l.url])).toEqual([
      ["second", "https://example.com/2"],
      ["first", "https://example.com/1"],
    ]);

    const updated = await call(`${LINKS}/first`, json("PUT", { url: "https://example.com/new" }));
    expect(updated.status).toBe(200);
    expect(await bodyOf(updated)).toMatchObject({
      slug: "first",
      url: "https://example.com/new",
      owner: "staff@stringify.gg",
      updatedBy: "staff@stringify.gg",
    });
    expect(storedLink("first")).toMatchObject({ url: "https://example.com/new", updatedBy: "staff@stringify.gg" });
    expect((await call("https://strin.gg/first")).headers.get("location")).toBe("https://example.com/new");

    expect((await call(`${LINKS}/first`, json("PUT", { url: "ftp://nope" }))).status).toBe(400);
    expect((await call(`${LINKS}/missing`, json("PUT", { url: "https://example.com/" }))).status).toBe(404);

    expect((await call(`${LINKS}/second`, { method: "DELETE" })).status).toBe(204);
    expect((await call(`${LINKS}/second`, { method: "DELETE" })).status).toBe(404);
    expect(storedLink("second")).toBeNull();
    expect((await call("https://strin.gg/second")).headers.get("location")).toBe("https://stringify.gg/");
  });

  test("lists every link, past KV's 1000-key page size", async () => {
    for (let i = 0; i < 1050; i++) {
      testEnv.URL_SHORTENER.entries.set(
        `links:k${i}`,
        JSON.stringify({ url: "https://example.com/", owner: "o", createdAt: "2026-01-01T00:00:00.000Z" }),
      );
    }
    expect(await bodyOf(await call(LINKS))).toHaveLength(1050);
  });
});

describe("admin page", () => {
  test("serves the app shell with no-store and security headers", async () => {
    resetTestEnv({ DEV_ADMIN_EMAIL: "staff@stringify.gg" });
    for (const path of ["/admin", "/admin/", "/admin/anything"]) {
      const res = await call(path);
      expect(res.status, path).toBe(200);
      // Vite's SSR environment doesn't run under Vitest, so the outlet stays unfilled here.
      expect(await res.text()).toContain('<div id="app">');
      expect(res.headers.get("cache-control")).toBe("no-store");
      expect(res.headers.get("x-content-type-options")).toBe("nosniff");
      expect(res.headers.get("referrer-policy")).toBe("no-referrer");
    }
  });

  test("entry-server renders the links admin", async () => {
    const { default: ssr } = await import("../app/entry-server.tsx");
    const html = await ssr.fetch(new Request("http://localhost/admin")).text();
    expect(html).toContain("<h1>strin.gg links</h1>");
    expect(html).toMatch(/<input [^>]*name="url"/);
    expect(html).toMatch(/<input [^>]*name="slug"/);
  });
});
