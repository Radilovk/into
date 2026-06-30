# AGENTS.md

## Cursor Cloud specific instructions

This repo is a **static frontend** (plain HTML/CSS/JS, deployed to GitHub Pages) plus a
**Cloudflare Worker backend** (`worker.js`, deployed with Wrangler). There is no
`package.json`, no build step, and no automated test suite. Node 22, Python 3, and
`wrangler` (via `npx`) are available.

### Services

| Service | How to run | Notes |
| --- | --- | --- |
| Static site (primary product) | `python3 -m http.server 8000` from repo root | Entry page is `main.html` (the IntoDesign portfolio site); `index.html` redirects to it. Other pages: `client-portal.html`, `acuity-manager.html`, `admin.html`, `chat.html`. |
| Worker backend API | `npx wrangler dev -c wrangler.dev.toml --port 8787` | Serves the Client Portal / CMS / Acuity API (routes under `/api/...`). |

### Important caveats (non-obvious)

- **Use `wrangler.dev.toml`, NOT the committed `wrangler.toml`, for local dev.** The
  production `wrangler.toml` uses the legacy `[[ai]]` array binding syntax, which modern
  Wrangler (v3/v4) rejects with `The field "ai" should be an object`. `worker.js` (the
  configured `main`) does not use the AI binding, so `wrangler.dev.toml` omits it and uses
  local placeholder KV namespace ids. Do not "fix" `wrangler.toml` casually — it reflects the
  production deploy config.
- `wrangler dev` runs the Worker against a **local** simulated KV store, so no real
  Cloudflare account or KV ids are needed. Data does not persist to production.
- The CMS admin password defaults to `intodesign2024` (`SITE_ADMIN_PASSWORD` env override).
  Useful for testing `/api/site-auth`.
- Acuity Scheduling endpoints (`/api/me`, `/api/availability`, `/api/book`, etc.) require
  `ACUITY_USER_ID`/`ACUITY_API_KEY` (or legacy `ACUITY_USER`/`ACUITY_KEY`) secrets and call the
  live Acuity API; they return errors without those credentials. The CMS/inquiry endpoints
  (`/api/health`, `/api/site-auth`, `/api/site-content`, `/api/inquiries`) work fully locally.
- "Lint" / "test": there is no configured linter or test runner. The closest available check
  is `node --check <file.js>` for JS syntax.
