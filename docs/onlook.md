# Onlook compatibility findings (2026-11-03)

**Result:** both spikes were opened in the Onlook desktop app and edited visually (text, colour, padding); the owner reported that all of it works. The plan continues as written: Vite + React admin, Astro 7 + server-only React sites, CSS Modules.

## How Onlook actually works with this repo
- Onlook creates a **git worktree per project** (branch `<user>/<name>`, under `~/Library/Application Support/Onlook Studio/workspaces/...`), cut from the **last committed HEAD**. Uncommitted files are invisible to it, so commit before opening Onlook.
- Its edits land on its own branch. Merge that branch before Claude continues (see `CLAUDE.md`).
- Onlook's agent can scaffold apps itself. For this repo that would collide with the plan, so point it at existing app folders instead.
- Onlook ran the spike dev servers from `spikes/onlook/{admin,sites}` (separate folders, each started with `pnpm dev`). That matches the plan's per-app dev server rule.

## Notes
- pnpm 11 blocks dependency build scripts. Every pnpm workspace here needs `allowBuilds` for `esbuild`, `workerd` and `sharp` in `pnpm-workspace.yaml`.
