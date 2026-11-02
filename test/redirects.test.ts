import { beforeEach, describe, expect, test } from "bun:test";
import worker, { type Env } from "../src/index";
import { MemoryKV } from "./memory-kv";

let kv: MemoryKV;
let env: Env;

beforeEach(() => {
  kv = new MemoryKV();
  env = { URL_SHORTENER: kv as unknown as KVNamespace };
});

function get(path: string): Promise<Response> {
  return worker.fetch(new Request(`https://strin.gg${path}`), env);
}

describe("legacy routes", () => {
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
    ["/admin-ish/x", 302, "https://stringify.gg/"],
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

  test("/cs resolves hand-written path values against stringify.gg", async () => {
    await kv.put("spring", "tournaments/123");
    await kv.put("nested/key", "/creators/runa");
    expect((await get("/cs/spring")).headers.get("location")).toBe("https://stringify.gg/tournaments/123");
    expect((await get("/cs/nested/key")).headers.get("location")).toBe("https://stringify.gg/creators/runa");
  });
});

describe("root slugs", () => {
  test("redirect to the stored destination with 302", async () => {
    await kv.put("docs", "https://docs.example.com/page?a=1");
    const res = await get("/docs");
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("https://docs.example.com/page?a=1");
    expect((await get("/cs/docs")).headers.get("location")).toBe("https://docs.example.com/page?a=1");
  });

  test("unknown, reserved or malformed slugs fall back", async () => {
    await kv.put("m", "https://example.com/");
    for (const path of ["/nope", "/m", "/favicon.ico"]) {
      const res = await get(path);
      expect(res.status).toBe(302);
      expect(res.headers.get("location")).toBe("https://stringify.gg/");
    }
  });
});
