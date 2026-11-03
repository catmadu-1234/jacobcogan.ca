# Session Plan

> **Superseded in places:** the current source of truth is `docs/superpowers/plans/2026-11-03-senka-cms.md`. It uses two Workers (not Pages), React rather than Svelte (for Onlook), and Astro sites with server-only React components.

**Created:** 2026-11-03
**Intent Contract:** See .claude/session-intent.md

## What You'll End Up With
One GitHub repo that deploys to one Cloudflare Pages project:

| Route | What it is |
|---|---|
| `/admin` | CMS for both owners. Behind Cloudflare Access, responsive, simple enough for a non-technical editor |
| `/api/admin/*` | Authenticated write API (Pages Functions → D1 + R2) |
| `/api/public/:site/*` | Read-only JSON API, so any other website can use the content later |
| `/:jacobSlug`, `/:herSlug` | Two separate, fast portfolio sites, each with its own design |
| `/media/*` | Images and videos served from R2 with immutable caching |

Later, each custom domain points at the same project. Middleware maps the hostname to a site, so `herdomain.com/` serves what `/her-slug` serves now.

## Architecture Decisions

**Framework: Astro (SSR, `@astrojs/cloudflare`) + Svelte islands for the admin.**
- The portfolios are server-rendered, ship almost no JavaScript and read D1 directly. That keeps them fast with no build step per publish.
- Edge caching: pages are cached with the site's `content_version` as part of the key. Publishing bumps the version, so new content shows instantly without a cache purge API.
- The admin is a Svelte single-page app under `/admin`, with small bundles.

**Data: D1 (SQLite).**
```
sites        (id, slug, name, hostname?, theme_json, content_version)
users        (email PK, site_id, role)              -- maps Access email → site
field_defs   (id, site_id, key, label, type[text|longtext|url], sort, required)
works        (id, site_id, slug, title, status[draft|published], year, sort,
              fields_json, cover_media_id, created_at, updated_at, published_at)
media        (id, site_id, work_id?, kind[image|video], r2_key, variants_json,
              width, height, duration, poster_key, alt, sort, bytes)
tags         (id, site_id, name, slug)
work_tags    (work_id, tag_id)
```
- Custom fields are defined per site in `field_defs`, and their values live in `works.fields_json`. Each owner can add fields like "Medium", "Dimensions" or "Collector" without a schema migration.
- Every query is scoped by `site_id`, which comes from the authenticated user and never from the client.

**Media: R2, with processing done in the browser (stays on the free tier).**
- Images are resized in the browser at upload to WebP variants (480 / 1200 / 2400px), plus the original and a blurhash placeholder. This avoids paying for Cloudflare Images.
- Videos are MP4 or WebM. The browser grabs a poster frame and reads the duration. Large files go through R2 multipart upload via the Worker, because a single request body is capped at 100MB.
- On a free-tier budget, 10GB of R2 fills up fast with video. The admin shows a storage meter and warns on uploads over 200MB.
- `/media/*` is served through a Function with `Cache-Control: immutable`. Later, switch to an R2 custom domain (`media.yourdomain.com`) to take media traffic off the Function request quota.

**Auth: Cloudflare Access (Zero Trust free tier, up to 50 users).**
- Login is by one-time email code, so there are no passwords to build or maintain.
- Access protects `/admin*` and `/api/admin/*`. The Function verifies the `Cf-Access-Jwt-Assertion` JWT, then looks up `users.email` to get the `site_id`.

**Free-tier check:** Functions allow 100k requests a day, D1 allows 5M reads a day, R2 has 10GB with free egress, and Access is free for up to 50 users. All of these are comfortably enough for two portfolios.

## Admin UX (frontend design focus)
- **Works grid** is the home screen: large thumbnails, filter by tag, a draft/published badge and drag to reorder.
- **Work editor** is one scrolling page:
  - title
  - a drag-and-drop media tray (reorder, set cover, alt text)
  - the custom fields
  - a tag input with autocomplete and create-on-enter
  - a Publish toggle and Save
  - autosave of drafts
- **Fields screen**: add, rename and reorder custom fields, in plain language ("Add a detail every work can have").
- **Tags screen**: rename, merge and delete tags.
- **Mobile**: a bottom tab bar, and the media tray uses the camera roll. Upload straight from a phone is a primary flow.
- **Style**: calm and neutral, so the artwork is what stands out. Clear empty states and inline confirmations rather than modal dialogs.

## Portfolio Sites (frontend design focus)
- Each site has its own Astro layout and theme in `src/sites/<slug>/`, sharing data helpers. The two can look completely different.
- Pages: index (grid or masonry), work detail (lightbox, video autoplay muted on hover/tap), tag filter, about.
- Speed:
  - `srcset` from the WebP variants, with explicit sizes and no layout shift
  - blurhash placeholders and lazy loading below the fold
  - view transitions between grid and detail
  - zero JavaScript on the index except the filter island
- Visual direction is chosen per site in a design session with each owner (`/octo:design-ui-ux`).

## How We'll Get There

### Phase Weights
- **Discover: 20%.** Check that the current Astro + Cloudflare adapter, D1 bindings and Access JWT verification work as planned. Collect visual references from both owners.
- **Define: 20%.** Lock the schema, API contract, site slugs and default fields. Set the design direction for the admin and both sites.
- **Develop: 32%.** In order:
  1. scaffold and CI
  2. D1 migrations
  3. admin API and auth
  4. upload pipeline
  5. admin UI
  6. public API
  7. portfolio site A
  8. portfolio site B
- **Deliver: 28%.**
  - API and permission tests (Vitest + Miniflare), including the cross-site isolation test
  - responsive QA at 360 / 768 / 1280 / 1920
  - Lighthouse
  - a usability walkthrough on a phone with the non-technical editor
  - a deploy runbook

### 🐙 Debate Checkpoint
- 🔸 After Define: "Server-rendered with a version-keyed cache, or static rebuild on publish?" One adversarial round. Static is faster but delays changes by about a minute after Publish, which may confuse a non-technical editor.

### Execution Commands
```bash
/octo:embrace "Build a Cloudflare-hosted headless CMS (D1 + R2 + Access) with responsive admin and two fast art portfolio sites, per .claude/session-plan.md"
```
Or run phases individually: `/octo:discover`, `/octo:define`, `/octo:develop`, `/octo:deliver`.

## Provider Requirements
🔴 Codex CLI: Available ✓
🟡 Gemini CLI: Available ✓
🟣 Perplexity: Available ✓
🟤 OpenCode: Not installed ✗
🔵 Claude: Available ✓

## Open Questions (answered in Define)
1. Site slugs and display names for both portfolios.
2. Default custom fields. Suggested: Medium, Dimensions, Year, Description, Availability.
3. Typical video length and size. This decides whether multipart upload is needed on day one.
4. Cloudflare account. Are your domains already on Cloudflare DNS? This affects when the R2 custom domain can be set up.
5. Any visual references or portfolios you each love.

## Success Criteria
See intent contract: production-ready, non-technical editor, low maintenance, free tier, fast and responsive.

## Next Steps
1. Review this plan.
2. Answer the open questions.
3. Execute with `/octo:embrace`.
