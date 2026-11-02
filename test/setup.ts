import { beforeEach, vi } from "vitest";
import { resetTestEnv } from "./env.ts";

// In dev and tests "cloudflare:workers" is aliased to this file (see nitro.config.ts).
// Replace it so tests use in-memory bindings instead of wrangler's local proxy.
vi.mock("../server/dev/cloudflare-workers.ts", async () => {
  const { testEnv } = await import("./env.ts");
  return { env: testEnv, ctx: {} };
});

beforeEach(() => {
  resetTestEnv();
  vi.unstubAllGlobals();
});
