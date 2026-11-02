# strin.gg

URL shortener/redirector for [stringify.gg](https://stringify.gg), running on Cloudflare Workers with [Nitro](https://nitro.build) and Vite. Staff can create short links to any destination from the admin page at `/admin`.

## Routes

| Pattern | Redirects to |
|---|---|
| `/m/<base64>` | `https://stringify.gg/match/<id>` |
| `/m/<base64>?p=<base64>` | `https://stringify.gg/share/match/<id>/<player_id>` |
| `/p/<base64>` | `https://stringify.gg/player/<id>` |
| `/c/<name>` | `https://stringify.gg/creators/<name>` |
| `/<slug>` | stored destination (CF KV lookup, `302`) |
| `/cs/<slug>` | same as `/<slug>` |
| `/admin` | link management page (Cloudflare Access only) |
| `/api/admin/links` | link management API (Cloudflare Access only) |

`/m/`, `/p/` and `/c/` redirect with `301`. Stored links redirect with `302` so edits take effect.
Unknown slugs and all other paths fall back to `https://stringify.gg` with a `302`.
`m`, `p`, `c`, `cs`, `admin`, `api` and `assets` are reserved and cannot be used as slugs.

## Encoding

`/m/` and `/p/` slugs are base10 IDs encoded in URL-safe base64 (RFC 4648 §5):

```
ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_
```

For example, `B` → `1`, `BA` → `64`, `CB` → `129`.

The optional `p` query parameter on `/m/` uses the same encoding and redirects to
Stringify's share page, which serves player-specific Open Graph metadata before
client-side navigation continues to the canonical match page.

## Development

```bash
bun install
echo 'DEV_ADMIN_EMAIL=you@stringify.gg' > .dev.vars  # admin login on localhost only
bun run dev        # Vite + Nitro; local KV lives in .wrangler/state
bun run typecheck
```

`bun run dev` runs the server in Node (see `nitro.config.ts` for why), with bindings from `wrangler.jsonc` supplied by wrangler's local proxy. To try the real Workers runtime, build and run it with `bun run build && npx wrangler dev`.

## Layout

| Path | What |
|---|---|
| `server/routes/` | `/` and the catch-all redirect route |
| `server/api/admin/links/` | admin JSON API |
| `server/middleware/admin-page.ts` | Access check and security headers for `/admin` |
| `server/utils/` | links, KV, Access and ID helpers |
| `app/` + `index.html` | admin page (nano-jsx, rendered on the server, then made interactive in the browser) |

## Deployment

```bash
bun run deploy
```

## KV Namespace

Short links live in the Cloudflare KV namespace bound as `URL_SHORTENER`, mounted in Nitro as `url_shortener`. Each link is stored under `links:<slug>` as JSON: `{ "url", "owner", "createdAt", "updatedBy"?, "updatedAt"? }`.

Links can still be added by hand:

```bash
npx wrangler kv key put --binding URL_SHORTENER "links:<slug>" '{"url":"https://…","owner":"you@stringify.gg","createdAt":"2026-01-01T00:00:00.000Z"}'
```

## Admin

`/admin` serves a small page backed by a JSON API:

| Method | Path | Does |
|---|---|---|
| `GET` | `/api/admin/links` | list all links, newest first |
| `POST` | `/api/admin/links` | create `{ "url": "...", "slug"?: "..." }`; a random 7-character slug when omitted |
| `PUT` | `/api/admin/links/<slug>` | change the destination `{ "url": "..." }` |
| `DELETE` | `/api/admin/links/<slug>` | delete |

The Worker verifies the `Cf-Access-Jwt-Assertion` header itself and records the signed-in email as the link owner; without `ACCESS_TEAM_DOMAIN` and `ACCESS_AUD` the admin answers `503`. Writes must be same-origin JSON.

## Cloudflare setup (outside this repo)

1. **Zero Trust → Access → Applications → Add → Self-hosted**: domain `strin.gg`, with two paths: `admin` (covers `/admin/*`) and `api/admin` (covers the API). Add an Allow policy for staff (e.g. emails ending in `@stringify.gg`, or a staff group).
2. Copy the application's **Audience (AUD) tag** and the team domain (**Zero Trust → Settings → Custom Pages**, `<team>.cloudflareaccess.com`) into `ACCESS_AUD` and `ACCESS_TEAM_DOMAIN` in `wrangler.jsonc`, then `bun run deploy`. `vars` in `wrangler.jsonc` replace dashboard variables on every deploy, so set them here rather than in the dashboard.
3. Make sure the Worker serves `strin.gg/*` (custom domain or route) so `/admin`, `/api/admin` and the root slugs reach it.
