import { defineConfig } from "vite";
import { nitro } from "nitro/vite";
import { cloudflare } from "@cloudflare/vite-plugin";

export default defineConfig({
  plugins: [nitro(),cloudflare({ viteEnvironment: { name: "worker" } })],
  environments: {
		worker: { build: { sourcemap: true } },
	},
});
