# strin.gg

URL shortener/redirector for [stringify.gg](https://stringify.gg), running on Cloudflare Workers. Staff can create short links to any destination from the admin page at `/admin`.

## Routes

| Pattern | Redirects to |
|---|---|
| `/m/<base64>` | `https://stringify.gg/match/<id>` |
| `/m/<base64>?p=<base64>` | `https://stringify.gg/share/match/<id>/<player_id>` |
| `/p/<base64>` | `https://stringify.gg/player/<id>` |
| `/c/<name>` | `https://stringify.gg/creators/<name>` |
| `/<slug>` | stored destination (CF KV lookup, `302`) |
| `/cs/<key>` | stored destination (CF KV lookup, `302`) |
| `/admin` | link management page and API (Cloudflare Access only) |

`/m/`, `/p/` and `/c/` redirect with `301`. Stored links redirect with `302` so edits take effect.
Unknown slugs and all other paths fall back to `https://stringify.gg` with a `302`.
`m`, `p`, `c`, `cs` and `admin` are reserved and cannot be used as slugs.

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
bun run dev
bun run test
bun run check
```

## Deployment

```bash
bun run deploy
```

## KV Namespace

Short links live in a Cloudflare KV namespace bound as `URL_SHORTENER`. The key is the slug and the value is the destination, resolved against `https://stringify.gg/`: links created from the admin page store an absolute URL, and older hand-written values such as `tournaments/123` keep working. Owner and timestamps are stored as KV metadata.

Links can still be added by hand:

```bash
npx wrangler kv key put --binding URL_SHORTENER "<key>" "<url or path>"
```

## Admin

`/admin` serves a small page backed by a JSON API:

| Method | Path | Does |
|---|---|---|
| `GET` | `/admin/api/links?cursor=` | list links, 100 per page |
| `POST` | `/admin/api/links` | create `{ "url": "...", "slug"?: "..." }`; a random 7-character slug when omitted |
| `PUT` | `/admin/api/links/<slug>` | change the destination `{ "url": "..." }` |
| `DELETE` | `/admin/api/links/<slug>` | delete |

The Worker verifies the `Cf-Access-Jwt-Assertion` header itself and records the signed-in email as the link owner; without `ACCESS_TEAM_DOMAIN` and `ACCESS_AUD` the admin answers `503`. Writes must be same-origin JSON.

## Cloudflare setup (outside this repo)

1. **Zero Trust → Access → Applications → Add → Self-hosted**: domain `strin.gg`, path `admin` (this covers `/admin/*`). Add an Allow policy for staff (e.g. emails ending in `@stringify.gg`, or a staff group).
2. Copy the application's **Audience (AUD) tag** and the team domain (**Zero Trust → Settings → Custom Pages**, `<team>.cloudflareaccess.com`) into `ACCESS_AUD` and `ACCESS_TEAM_DOMAIN` in `wrangler.jsonc`, then `bun run deploy`. `vars` in `wrangler.jsonc` replace dashboard variables on every deploy, so set them here rather than in the dashboard.
3. Make sure the Worker serves `strin.gg/*` (custom domain or route) so `/admin` and the root slugs reach it; no new bindings are needed, the existing `URL_SHORTENER` KV namespace is reused.
