import { describe, expect, test } from "vitest";
import { call, testEnv } from "./env.ts";

const get = (path: string) => call(`https://strin.gg${path}`);

function storeLink(slug: string, url: string) {
  testEnv.URL_SHORTENER.entries.set(
    `links:${slug}`,
    JSON.stringify({ url, owner: "staff@stringify.gg", createdAt: "2026-01-01T00:00:00.000Z" }),
  );
}

describe("fixed routes", () => {
  const cases: [string, number, string][] = [
    ["/m/B", 301, "https://stringify.gg/match/1"],
    ["/m/BA", 301, "https://stringify.gg/match/64"],
    ["/m/CB?p=B", 301, "https://stringify.gg/share/match/129/1"],
    ["/p/CB", 301, "https://stringify.gg/player/129"],
    ["/c/runa", 301, "https://stringify.gg/creators/runa"],
    ["/c/a/b", 301, "https://stringify.gg/creators/a/b"],
    ["/", 302, "https://stringify.gg/"],
    ["/m", 302, "https://stringify.gg/"],
    ["/cs", 302, "https://stringify.gg/"],
    ["/m/B/extra", 302, "https://stringify.gg/"],
    ["/admin-ish/x", 302, "https://stringify.gg/"],
    ["/x/y/z", 302, "https://stringify.gg/"],
    ["/api", 302, "https://stringify.gg/"],
    ["/api/nope", 302, "https://stringify.gg/"],
    ["/cs/missing", 302, "https://stringify.gg/"],
  ];
  for (const [path, status, location] of cases) {
    test(path, async () => {
      const res = await get(path);
      expect(res.status).toBe(status);
      expect(res.headers.get("location")).toBe(location);
    });
  }

  test("bad ids are rejected", async () => {
    expect((await get("/m/B!")).status).toBe(400);
    expect((await get("/m/B?p=!")).status).toBe(400);
    expect((await get("/p/%20")).status).toBe(400);
  });
});

describe("stored links", () => {
  test("redirect to the stored destination with 302, at /<slug> and /cs/<slug>", async () => {
    storeLink("docs", "https://docs.example.com/page?a=1");
    for (const path of ["/docs", "/cs/docs"]) {
      const res = await get(path);
      expect(res.status).toBe(302);
      expect(res.headers.get("location")).toBe("https://docs.example.com/page?a=1");
    }
  });

  test("unknown, reserved or malformed slugs fall back", async () => {
    storeLink("m", "https://example.com/");
    storeLink("api", "https://example.com/");
    for (const path of ["/nope", "/m", "/api", "/favicon.ico", "/cs/a/b"]) {
      const res = await get(path);
      expect(res.status).toBe(302);
      expect(res.headers.get("location")).toBe("https://stringify.gg/");
    }
  });
});
