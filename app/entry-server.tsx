import { renderSSR } from "nano-jsx/esm/index.js";
import { App } from "./App.tsx";

// Nitro puts this response into index.html at <!--ssr-outlet-->.
export default {
  fetch(req: Request) {
    const { pathname } = new URL(req.url);
    return new Response(renderSSR(() => <App />, { pathname }));
  },
};
