import { defineMiddleware } from "nitro";

// Dev runs in Node (see nitro.config.ts), so give requests the same bindings
// workerd would, from the dev `cloudflare:workers` stand-in. Stripped from production builds.
export default defineMiddleware(async (event) => {
  if (!import.meta.dev || event.req.runtime?.cloudflare) return;
  const { env, ctx } = await import("../dev/cloudflare-workers.ts");
  event.req.runtime = { ...event.req.runtime, name: "cloudflare", cloudflare: { env, context: ctx } };
});
