import { defineMiddleware } from "nitro";
import { requireAdmin } from "../utils/access.ts";

// Vite's dev client needs inline styles and a websocket, so the CSP only applies to builds.
const CSP =
  "default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self'; " +
  "frame-ancestors 'none'; base-uri 'none'; form-action 'none'";

/** The admin page (rendered from index.html) is staff-only, like its API. */
export default defineMiddleware(async (event) => {
  const { pathname } = event.url;
  if (pathname !== "/admin" && !pathname.startsWith("/admin/")) return;

  await requireAdmin(event);
  const headers = event.res.headers;
  headers.set("cache-control", "no-store");
  headers.set("referrer-policy", "no-referrer");
  headers.set("x-content-type-options", "nosniff");
  if (!import.meta.dev) headers.set("content-security-policy", CSP);
});
