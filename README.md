# Senka

A small publishing tool for two art portfolios. Each artist signs in to the **admin**, adds works (images or videos, their own detail fields, tags) and flips them to **Visible on site**. Each artist has a fast, quiet **gallery site** that shows whatever is visible.

Everything runs on Cloudflare's free plan.

```
apps/admin      the admin: React app + a small API, behind a Cloudflare Access login
apps/sites      both gallery sites: Astro, rendered on the server, no JavaScript on the grid pages
packages/core   the database queries and rules both of them share
migrations/     the database tables
seed/           the starting data (two sites, who can edit each, the default details)
docs/           design spec, deploy guide, implementation plan
```

- **Putting it online:** [docs/deploy.md](docs/deploy.md)
- **How it looks and behaves:** [docs/design-spec.md](docs/design-spec.md)
- **How it was built, task by task:** [docs/superpowers/plans/2026-11-03-senka-cms.md](docs/superpowers/plans/2026-11-03-senka-cms.md)

## Running it on your computer

```bash
pnpm install
cp apps/admin/.dev.vars.example apps/admin/.dev.vars   # signs you in locally as site A's owner
pnpm seed:demo                                          # fills a local database with sample works
pnpm dev:admin                                          # the admin, usually http://localhost:5173
pnpm dev:sites                                          # the galleries, usually http://localhost:4321/site-a
```

Both use the same local database, kept in `.wrangler/state`. To sign in as the other artist, change `DEV_USER_EMAIL` in `apps/admin/.dev.vars` to `b@test.dev` and restart the admin. `pnpm seed:demo` only ever touches this local copy and can be run again whenever you like.

Checks: `pnpm test`, `pnpm typecheck`, `pnpm build`.

## Designing with Onlook

[Onlook](https://www.onlook.com) edits the look of the admin and the galleries visually and writes the change back as code. It works from a git copy of this project, so:

1. **Commit first.** Onlook only sees what has been committed.
2. Open `apps/admin` or `apps/sites` in Onlook (run `pnpm seed:demo` beforehand so there is something to look at).
3. Onlook saves its edits on its own git branch. **Merge that branch** before asking Claude to carry on.

To keep Onlook able to read the code, `CLAUDE.md` lists a few rules (one React component per file, styles in a `.module.css` beside it, and so on).
