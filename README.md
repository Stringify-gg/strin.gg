# strin.gg

Stateless URL shortener/redirector for [strinova.gg](https://strinova.gg), running on Cloudflare Workers.

## Routes

| Pattern | Redirects to |
|---|---|
| `/m/<base64>` | `https://strinova.gg/match/<id>` |
| `/m/<base64>?p=<base64>` | `https://strinova.gg/match/<id>?fromPlayer=<id>` |
| `/p/<base64>` | `https://strinova.gg/player/<id>` |
| `/c/<name>` | `https://strinova.gg/creator/<name>` |
| `/cs/<key>` | `https://strinova.gg/<kv_value>` (CF KV lookup) |

All other paths fall back to `https://strinova.gg` with a `302`.

## Encoding

`/m/` and `/p/` slugs are base10 IDs encoded in URL-safe base64 (RFC 4648 §5):

```
ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_
```

For example, `B` → `1`, `BA` → `64`, `CB` → `129`.

The optional `p` query parameter on `/m/` uses the same encoding and is expanded into `fromPlayer`.

## Development

```bash
bun install
bun run dev
```

## Deployment

```bash
bun run deploy
```

## KV Namespace

Custom slugs (`/cs/<key>`) are stored in a Cloudflare KV namespace bound as `URL_SHORTENER`. The value should be a path string (e.g. `tournaments/123`), which gets appended to `https://strinova.gg/`.

To add a custom slug:

```bash
npx wrangler kv key put --binding URL_SHORTENER "<key>" "<path>"
```
