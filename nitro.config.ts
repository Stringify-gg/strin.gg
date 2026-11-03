import { defineConfig } from "nitro";

export default defineConfig({
  serverDir: "./server",
  preset: "cloudflare_module",
  // The default dev runner (workerd) can't render index.html's <!--ssr-outlet-->:
  // Nitro compiles that template at runtime with `new Function`, which workerd forbids.
  // Dev runs in Node instead; server/middleware/cloudflare-dev.ts supplies the bindings.
  devServer: { runner: "node-worker" },
  $development: {
    // Lets the KV driver (and our code) import `env` from "cloudflare:workers" in Node.
    alias: { "cloudflare:workers": "./server/dev/cloudflare-workers.ts" },
  },
  modules: [
    // Nitro mounts the index.html renderer (the SSR app) at "/**", where
    // server/routes/[...slug].ts shadows it. Mount it under /admin as well.
    (nitro) => {
      const handler = nitro.options.renderer?.handler;
      if (handler) nitro.options.handlers.push({ route: "/admin/**", handler, lazy: true });
    },
  ],
  kv: {
    // `binding` is the binding's name; the driver looks it up per request via `cloudflare:workers`.
    url_shortener: { driver: "cloudflare-kv-binding", binding: "URL_SHORTENER" },
  },
});
