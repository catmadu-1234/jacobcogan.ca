# Senka — project rules

Two Cloudflare Workers (`apps/admin`, `apps/sites`) share one D1 database and one R2 bucket; all SQL lives in `packages/core`.
Plan: `docs/superpowers/plans/2026-11-03-senka-cms.md`. Design: `docs/design-spec.md`.

## Onlook compatibility (do not break)
The owner edits UI visually in the Onlook desktop app. Every change must keep the UI Onlook-editable:
- All UI is React function components in `.tsx`, one component per file, with JSX written out (no markup generated from config arrays).
- Styles: global tokens as CSS custom properties in `tokens.css`; component styles in a `Component.module.css` beside the component. No Tailwind, no CSS-in-JS, no inline style objects except CSS-variable values (e.g. `--ar`).
- Components take plain serialisable props and never fetch data. Data loading lives in `.astro` pages (sites) or screen-level hooks (admin).
- In `apps/sites`, `.astro` files only load data and render one React page component; never add `client:*` directives (pages must ship zero JS).
- Each app must start with `pnpm dev` from its own folder.

## Handoff between Claude and Onlook
- Finish and commit before the owner opens Onlook; never leave the tree mid-change.
- Onlook works from a git worktree cut from the last commit and commits to its own branches. Before continuing work, run `git status` and `git log --oneline -5 --all`; if an Onlook branch is unmerged, ask the owner whether to merge it first.
- Local content for visual editing: `pnpm seed:demo` (local only).

## Copy and UX
"Details" (not fields), "Visible on site" / "Hidden", "Add work". Never use alert/confirm/prompt; destructive actions use Undo toasts.

## Tooling notes
- pnpm 11 blocks dependency build scripts: each `pnpm-workspace.yaml` lists `allowBuilds` (esbuild, workerd, sharp).
