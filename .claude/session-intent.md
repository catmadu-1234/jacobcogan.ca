# Session Intent Contract

**Created:** 2026-11-03

## Job Statement
Build a small headless CMS for two art portfolios: Jacob's and his girlfriend's. It runs on GitHub + Cloudflare (Pages, Workers/Functions, D1, R2). Build the two portfolio sites that read from it too. Both sites are fast, beautiful and work at every screen size. Host on one `*.pages.dev` project for now and move to custom domains later.

## Intent Answers
| Question | Answer |
|---|---|
| Goal | Build something (inferred from request) |
| Knowledge | Well-informed (Cloudflare Workers / D1 / R2) |
| Scope clarity | General direction |
| Success | Production-ready |
| Constraints | Non-technical editor, Low maintenance, Time pressure, Free tier only |

## Success Criteria
1. Both owners can log in, create and edit works, upload images and/or videos, add custom text fields and tags, and publish. No developer help needed.
2. Each owner sees and edits only their own site's content.
3. Both portfolio sites are live on `*.pages.dev` (`/<slug>` routes) with good Lighthouse performance (target ≥ 95 on mobile).
4. The admin UI and the portfolios work well from 360px phones up to wide desktops.
5. Everything runs within Cloudflare's free tiers.
6. A custom domain can be attached later without code changes beyond config.
7. Tests cover the API and permissions. CI deploys automatically from GitHub.

## Boundaries
- Text-type custom fields only: short text, long text, URL. No rich page-builder.
- No paid services such as Cloudflare Stream, paid Images plans or third-party auth.
- No passwords to manage. Auth is delegated to Cloudflare Access with email codes.
- Two sites now. The data model is multi-site, so a third site is a row in the database, not a fork.
- Video is self-hosted MP4 in R2. No adaptive streaming.
