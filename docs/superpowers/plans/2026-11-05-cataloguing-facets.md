# Cataloguing facets Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace free-text Medium/Project and the general Tags list with four per-site tag-style facets (Medium, Project, Content, Exhibition), a validated four-digit Year, and "i" help on every facet.

**Architecture:** Two new tables (`facet_values`, `work_facet_values`) hold per-site, per-facet vocabularies and links; the old `tags`/`work_tags` are left untouched as a record. Core exposes `setWorkFacets`/`facetsForWork`/`listFacetValues`; admin and sites consume them. A one-off, idempotent backfill script copies existing Medium/Project text into facets.

**Tech Stack:** Cloudflare D1/Workers, Hono, Astro, React, zod, vitest.

**Spec:** `docs/superpowers/specs/2026-11-05-cataloguing-facets-design.md`

## Global Constraints
- Onlook rules in `CLAUDE.md`: one component per file, CSS modules, no markup from config arrays (the six facet rows are written out in JSX).
- Copy: never alert/confirm/prompt; "Details", "Visible on site" / "Hidden".
- Year is exactly four digits (`/^\d{4}$/`), optional, enforced on the server and in the editor.
- Slugs match as today (`tagSlug`); a value is unique per (site, facet, slug).
- Values nobody carries disappear from suggestions and the filter rail; originals stay in `fields_json`.
- `?tag=` is dropped; filter keys are medium, project, content, exhibition, year.

## Review Focus
- A work with several mediums appears under each, counted once per value, on the server and in the in-place script.
- "Dogs" under Content and "dogs" under Medium are different values.
- A Year like `c. 2019` or `24` is rejected with a clear message; empty Year is allowed.
- Removing the last use of a value removes it from suggestions.
- Backfill run twice makes no duplicates; "Digital sculpture and illustration" stays one Medium.

### Task 1: Core data layer
**Files:** Create `migrations/0003_facets.sql`, `packages/core/src/db/facets.ts`, `packages/core/test/facets.test.ts`; Modify `types.ts`, `validate.ts`, `public.ts`, `index.ts`, `db/works.ts`; Delete `db/tags.ts`, its test.
**Interfaces — Produces:** `FACETS`, `Facet`, `FacetValue`; `listFacetValues(db, siteId): Promise<Record<Facet, FacetValue[]>>`; `facetsForWork(db, workId): Promise<Record<Facet, FacetValue[]>>`; `setWorkFacets(db, siteId, workId, input: Partial<Record<Facet, string[]>>): Promise<Record<Facet, FacetValue[]>>` (replaces named facets, prunes orphans); `WorkPatch.facets`; `PublicWork.facets: Record<Facet, {name, slug}[]>`.
- [ ] Tests first: per-facet uniqueness, replace/prune, slug dedupe ("Oil"/"oil"), Year validation cases, public output.
- [ ] Implement; archive `medium`/`project` field defs in the migration; commit.

### Task 2: Admin API
**Files:** Modify `apps/admin/src/worker/routes/works.ts`, `index.ts`; Create `routes/facets.ts`; Delete `routes/tags.ts`; tests.
**Interfaces:** `GET /api/facets -> Record<Facet, FacetValue[]>`; `GET /api/works/:id -> { work, media, facets }`; `PATCH /api/works/:id` accepts `facets`; Year validation errors return 400 `invalid` with path `fields.year`.

### Task 3: Admin UI
**Files:** Create `components/FacetField.tsx` (+css) wrapping `TagInput`, `components/InfoTip.tsx` (+css), `lib/facetHelp.ts`; Modify `Editor.tsx`, `useEditor.ts`, `TagInput.tsx` (labels), `Shell.tsx`, `App.tsx`, `router.ts`, `useWorks.ts`, `Works.tsx`; Delete Tags screen, `TagRow`, `useTags`, their tests.
- [ ] Editor shows Medium, Project, Content, Exhibition, Year, Dimensions in that order, each with an "i" button that opens plain-language help; Year shows an inline error until four digits.

### Task 4: Public sites
**Files:** Modify `apps/sites/src/lib/filters.ts`, `ui/FilterRail.tsx`, `ui/IndexPage.tsx`, `ui/WorkPage.tsx`, `ui/IndexList.tsx`, `scripts/filter.ts`, `test/*`.
- [ ] Multi-value facets, five filter groups, empty groups hidden, no tag chip, work page lists facets as links.

### Task 5: Data move and release
**Files:** Create `scripts/backfill-facets.mjs`; Modify `scripts/seed-demo.mjs`, `seed/seed.sql`, docs.
- [ ] Backfill (idempotent) splits Medium/Project on `,`/`;`; run against production after deploy; deploy admin and sites; push.
