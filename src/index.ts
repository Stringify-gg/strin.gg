const BASE = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
const BASE_SIZE = BigInt(BASE.length);

export interface Env {
  CUSTOM_SLUGS: KVNamespace;
}

function b64ToNumber(slug: string): bigint | null {
  let result = 0n;
  for (const char of slug) {
    const idx = BASE.indexOf(char);
    if (idx === -1) return null;
    result = result * BASE_SIZE + BigInt(idx);
  }
  return result;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const { pathname } = new URL(request.url);
    const parts = pathname.split("/").filter(Boolean);

    if (parts.length < 2) {
      return new Response("Not Found", { status: 404 });
    }

    const [prefix, ...rest] = parts;
    const slug = rest.join("/");

    if (prefix === "m" || prefix === "p") {
      const id = b64ToNumber(slug);
      if (id === null) return new Response("Bad Request", { status: 400 });
      const section = prefix === "m" ? "match" : "player";
      return Response.redirect(`https://strinova.gg/${section}/${id}`, 301);
    }

    if (prefix === "c") {
      return Response.redirect(`https://strinova.gg/creator/${slug}`, 301);
    }

    if (prefix === "cs") {
      const value = await env.CUSTOM_SLUGS.get(slug);
      if (value === null) return new Response("Not Found", { status: 404 });
      return Response.redirect(`https://strinova.gg/${value}`, 301);
    }

    return new Response("Not Found", { status: 404 });
  },
} satisfies ExportedHandler<Env>;
