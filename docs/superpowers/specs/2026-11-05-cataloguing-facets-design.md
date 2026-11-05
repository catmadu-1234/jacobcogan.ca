# Cataloguing facets for ArtMS

## Intent
The artists using ArtMS (Jacob and Senka) want to describe each work the way an archivist or gallery would, so that
(a) they understand their own process better, by seeing which mediums, projects, subjects and shows their work
clusters into, and (b) visitors to their sites can browse and understand the work through the same lenses.

Today a work has free-text "details" (Medium, Project, Year, Dimensions, Description, Availability) plus a loose,
general "Tags" list. Free text drifts ("oil", "Oil on canvas", "oils"), so filters fragment, and the general Tags list
duplicates what Medium and Project already do. This replaces both with six named facets.

## The facets
| Facet | Values per work | How it is entered |
|---|---|---|
| Medium | many | tag input, suggestions from the site's existing Mediums, new ones added on the spot |
| Project | many | same, own vocabulary |
| Content | many | same, own vocabulary. Examples: people, landscapes, dogs |
| Exhibition | many | same, own vocabulary |
| Year | one | single text input, must be exactly four digits (e.g. 2024) |
| Dimensions | one | free text |

Each tag-style facet keeps its **own** vocabulary per site: "dogs" under Content never appears under Medium.

### Controlled vocabulary, in plain terms
There is no separate "manage the lists" step. While editing a work you pick an existing value or type a new one, and
a new one joins that site's list for that facet. Near-duplicates are prevented automatically: "Oil", "oil" and
"OIL " count as the same value (matched by slug, as tags already are). Consistency for Year comes from validation
instead: the field only accepts four digits.

## Goals
- Five tag-style behaviours are really four: Medium, Project, Content and Exhibition, each multi-value.
- Year is validated to four digits, in the editor and on the server, so values are consistent by construction.
- Every facet has a small "i" icon. Pressing it explains in plain language what to write, why it helps the artist
  see their own process, and why it helps viewers read the work. The wording is drafted by the builder and edited
  by Jacob.
- The public filter rail offers Medium, Project, Content, Exhibition and Year, built from what the works carry.
- The general "Tags" list is removed from the CMS entirely: the editor row, the Tags API and its screens.

## Non-goals
- No separate admin screen for managing vocabularies up front.
- No new facets beyond these six, and artists cannot add their own facets.
- No hierarchy or synonyms between values (e.g. "oil" under "painting").
- No change to Description, Availability or custom details beyond them losing Medium, Project and Year.

## Anti-goals (would be a failure even if it technically works)
- Losing existing data: every current Medium, Project, Year and tag value must end up somewhere visible.
- Filters on live sites breaking or going empty during the change.
- A tag input that is awkward on a phone. Artists edit from phones.
- Breaking Onlook editability (see `CLAUDE.md`: one component per file, CSS modules, no markup from config).

## Constraints
- Two Workers (`apps/admin`, `apps/sites`) share one D1 database; all SQL lives in `packages/core`.
- Changes need a migration (`migrations/`), applied to the production database `senka-db`.
- UI copy follows the project rules: "Details", "Visible on site" / "Hidden", never alert/confirm/prompt;
  destructive actions use Undo toasts.
- Pages on the sites ship zero JS beyond the existing small in-place filter script, which must keep agreeing with the
  server's filtering (`apps/sites/src/lib/filters.ts`).

## Decisions made together
- Medium, Project, Content and Exhibition are tag-style and multi-value; Medium too.
- Year is a plain single input with four-digit validation, not a tag.
- Dimensions is a single free-text value.
- New values are created on the spot while editing a work.
- The general Tags list is removed.
- Content values are things like people, landscapes, dogs.

## Calls made by the author (not yet confirmed)
- A value is stored per facet: the `tags` table gains a `facet` column (`medium|project|content|exhibition`), and
  uniqueness becomes (site, facet, slug). `work_tags` stays as the link table.
- Year is stored as today in the work's details (`fields_json`) and stays optional.
- Public filtering selects at most one value per facet in the URL (`?medium=oil&content=dogs`), values across facets
  combine with AND, as today. A work with several mediums appears under each. The old `?tag=` parameter is dropped.
- Medium and Project text details are removed from the Details settings and from the editor's details list.
  Custom details the artists added keep working.
- Existing text values migrate into the matching facet's tags (split on commas and semicolons). Existing
  "Year" values keep their four-digit year and flag any they cannot parse.
- Existing general tags move into a facet chosen by the owners (see open question below).

## Left to the builder
- Component structure and CSS for the tag input, the "i" popover and the filter rail changes.
- Exact normalisation rules for Year ("c. 2019" is rejected on input; migration extracts the four digits).
- Test coverage, migration safety and rollback approach, and deployment order.

## What the live data looks like (read 2026-11-05, production `senka-db`)
- General tags: only three. Site A: "Sculpture" (1 work), "digital" (1 work). Site B: "Painting" (0 works).
- Site A: one real work ("RainMan": Medium "Digital sculpture and illustration", Project "Collectibles", Year 2025,
  Dimensions `6"x2"`) and one empty draft.
- Site B (Senka): nine works already entered, with Medium (mostly "Acrylic", one "Sculpture, Acrylic"), Project
  ("Inner Lives" on three) and Year (2021, 2022). Her years are already four digits. She is editing this live, so the
  migration must be additive and safe to run while she works.

## Answers to the builder check
- **Existing tags.** Move "Sculpture", "digital" and "Painting" into the Medium facet (author's call, based on what the
  words are). Tags removal ships in the same change.
- **Both sites.** Facet vocabularies are per site (the `tags` table already has `site_id`). Each artist edits only her or
  his own site through the side picker; a work belongs to one site.
- **What can't be placed cleanly.** Nothing is deleted: the original Medium, Project and Year text stays in the work's
  `fields_json` as a record, and the new tags are added alongside. Split Medium and Project only on commas and
  semicolons, never on words like "and", so "Digital sculpture and illustration" becomes one Medium (the owners may
  split it themselves). A Year that is not four digits is left as is and the editor shows it with a "needs four digits"
  notice until fixed.
- **Typos and unused values.** A value no work carries any more is dropped from that facet's suggestions and from the
  filter rail, so a typo disappears once it is removed from the work. Renaming is not in this change.
- **Filter rail.** A facet with no values on the site is hidden; Year lists the individual years, newest first. The
  server and the in-place script use the same rule, as `filters.ts` already does for Medium, Project and Year.
- **Old `?tag=` links.** Ignored; no redirect, as the three old tags are few and nobody links to them.
