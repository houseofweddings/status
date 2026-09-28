# House of Weddings status

Uptime monitoring for houseofweddings.ai, with our own status page at
https://status.houseofweddings.ai.

- **Monitoring** is [Upptime](https://upptime.js.org): GitHub Actions check every URL in
  `.upptimerc.yml` every five minutes, commit the results to `history/`, and open an issue
  labelled `status` when something goes down (closed automatically on recovery).
- **The page** is `status-page/` (not `site/`: Upptime builds its own site into that folder and
  fails if it already exists) — plain HTML, CSS and JS, no build. It reads `history/` and the issues
  at view time, so it is current without redeploying. Styled with the `wedding` tokens from
  how-platform's `packages/config/themes.ts`; if the palette changes there, change
  `status-page/assets/status.css`.
- It is hosted on GitHub Pages, **not** on Vercel, so it stays up when the app does not. The
  fonts load from `houseofweddings.ai/fonts/` and fall back to system fonts during an outage.

## Setup (once)

1. Repository secret `SMOKE_TEST_TOKEN` — same value as in how-platform.
2. Vercel Firewall custom rule: header `x-smoke-test` equals that token → **Bypass**. Without it
   Vercel denies GitHub's runners and every monitor reads "down".
3. Repository secret `GH_PAT` — Upptime needs it to commit and open issues (see Upptime docs).
4. Settings → Pages → Source: **GitHub Actions**.
5. Custom domain `status.houseofweddings.ai`: a `status` CNAME → `houseofweddings.github.io` in
   Vercel DNS (it overrides the `*` wildcard the org subdomains use), plus Settings → Pages →
   Custom domain. Deploys come from Actions, so there is no `CNAME` file.

## Preview locally

    python3 -m http.server -d status-page 8080

The page reads `data-source` / `data-issues` on `<html>` if set, so a preview can point it at
sample files instead of GitHub.
