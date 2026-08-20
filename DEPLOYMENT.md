# Deploying Oddments

Oddments builds to a fully static site (`next build` → `./out`). There is no
server code, no database, and no runtime configuration — any static host can
serve it. This document describes the intended setup: **Cloudflare Pages**,
free tier, with optional Cloudflare Web Analytics.

Nothing in this document has been provisioned automatically: creating the
Cloudflare project, tokens, and domains is deliberately left to a human.

## What the repository already provides

- **Static export** — `npm run build` emits `./out` with an `index.html`,
  one HTML file per route, `404.html`, `robots.txt`, `sitemap.xml`, and
  build-time-generated icons and a social-preview image.
- **`public/_headers`** — security headers (CSP tuned to what the tools
  actually do, including the Regex Workbench blob worker) and immutable
  caching for hashed assets. Cloudflare Pages applies it automatically.
- **`.node-version`** — pins Node 22 for Pages' build image.
- **Build-time configuration** (see `.env.example`):
  - `NEXT_PUBLIC_SITE_URL` — the public origin. Controls canonical URLs,
    `og:url`, `robots.txt`'s sitemap pointer, and `sitemap.xml`. Unset, these
    fall back to `http://localhost:3000` — fine for development, wrong for
    production.
  - `NEXT_PUBLIC_CF_BEACON_TOKEN` — Cloudflare Web Analytics token. Unset,
    the site ships **zero analytics code**.

## One-time Cloudflare Pages setup

1. Cloudflare dashboard → **Workers & Pages → Create → Pages →
   Connect to Git** → select `blairhartman/oddments`.
2. Build settings:
   - Framework preset: **None** (some "Next.js export" presets prefill the
     removed `next export` command — type the values yourself).
   - Build command: `npm run build`
   - Build output directory: `out`
3. Environment variables (Production):
   - `NEXT_PUBLIC_SITE_URL` = the real origin, no trailing slash
     (start with `https://<project>.pages.dev`; update when a custom domain
     is attached, then redeploy).
4. Deploy. The `*.pages.dev` URL works immediately, including deep links
   (`/tools/pastewright` is served from `tools/pastewright.html`; a trailing
   slash redirects to the canonical slashless URL) and the custom 404.

Direct upload works too, if you prefer not to connect Git. Dashboard
environment variables do **not** apply to local builds, so set the origin in
the shell (or `.env.local`) first — otherwise the build bakes in localhost
URLs (the build prints a warning when this happens):

```bash
NEXT_PUBLIC_SITE_URL=https://oddments.example.com npm run build
npx wrangler pages deploy out
```

(Cloudflare has been steering new _dynamic_ projects toward Workers with
static assets; for a purely static site, Pages remains the simplest fit and
also reads `_headers`. Nothing in the repo is Pages-specific except that
file's location convention.)

## Analytics (optional, recommended at launch)

Route-level page views only — see the Privacy page and README for the
boundary (no tool input or output, ever).

1. Cloudflare dashboard → **Analytics & Logs → Web Analytics → Add a site**.
   Use manual installation to obtain the beacon **token** (the snippet's
   `"token": "…"` value); the site itself already knows how to render the
   script.
2. Set `NEXT_PUBLIC_CF_BEACON_TOKEN` = that token in the Pages project's
   production environment variables.
3. Redeploy. The beacon (`static.cloudflareinsights.com/beacon.min.js`) is
   already allowed by the CSP; it is cookieless and tracks SPA navigations,
   so per-tool views are distinguishable in the Web Analytics dashboard by
   path.

To turn analytics off, remove the variable and redeploy — the script
disappears from the HTML entirely.

## Custom domain

Recommended shape: a dedicated subdomain of a domain you already own, e.g.
`oddments.example.com` — memorable, cheap (free), and it keeps the option of
a standalone domain later without breaking anything (Pages can add redirects
if the site ever moves).

1. Pages project → **Custom domains → Set up a custom domain**.
2. Follow the CNAME instructions (automatic if the domain's DNS is on
   Cloudflare).
3. Update `NEXT_PUBLIC_SITE_URL` to the new origin and redeploy so
   canonicals, `og:url`, and the sitemap all say the same thing.

Optional hardening once the domain is settled: HTTP Strict Transport Security
(`Strict-Transport-Security: max-age=31536000`) — deliberately not shipped in
`_headers` because HSTS is effectively irreversible for the domain; enable it
in Cloudflare (SSL/TLS → Edge Certificates → HSTS) when you're sure the
domain will stay HTTPS-only.

## After the first deploy — verification checklist

```bash
curl -sI https://<site>/ | grep -iE 'content-security-policy|x-frame|x-content|referrer|permissions'
```

- `/` loads; every tool loads from a **direct deep link** and from a refresh.
- An unknown URL shows the Oddments 404 (with HTTP status 404).
- `/robots.txt` and `/sitemap.xml` reference the real origin.
- Paste a tool URL into a link-preview debugger (e.g. a Slack DM to
  yourself): title, description, and the Oddments card image appear.
- Regex Workbench: load an example and confirm matches appear (this proves
  the blob worker runs under the CSP).
- Pastewright: "Copy for destination" produces rich text (https origins are
  secure contexts, so the rich clipboard path is active).
- If analytics was enabled: the dashboard shows the visit; the beacon
  request carries no query strings with content.

## Not configured on purpose

- No `wrangler.toml` — nothing here needs Workers configuration.
- No Cloudflare Functions, KV, D1, or R2 — there is no backend.
- No preview-environment analytics — set the token only for Production.
- No third-party analytics service — Cloudflare's is enough to learn which
  tools people use; revisit only if a concrete question can't be answered.
