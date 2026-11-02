// Dev-only stand-in for the `cloudflare:workers` module (aliased in nitro.config.ts).
// Dev runs in Node, so read the bindings from wrangler.jsonc through wrangler's local proxy.
import { getPlatformProxy } from "wrangler";

const platform = await getPlatformProxy<Env & Record<string, unknown>>();

export const env = platform.env;
export const ctx = platform.ctx;
