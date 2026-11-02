import { defineConfig } from "vitest/config";
import { nitro } from "nitro/vite";

export default defineConfig({
  // Bundle these so they load (external packages fail in Nitro's Vitest environment) and so
  // unstorage's `import("cloudflare:workers")` reaches the mocked bindings in test/setup.ts.
  plugins: [nitro({ noExternals: ["jose", "nano-jsx", "unstorage"] })],
  test: {
    include: ["test/**/*.test.ts"],
    setupFiles: ["test/setup.ts"],
  },
});
