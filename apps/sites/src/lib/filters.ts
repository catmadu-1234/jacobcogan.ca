// The rules for filtering a gallery by Medium, Project, Year (and a tag). Used by the server when it renders a
// page and by the small script that filters in place in the browser, so both always agree. Nothing here may
// import server-only code: only types and the pure slug helper.
import { tagSlug } from "@senka/core/slug";
import type { PublicWork } from "@senka/core";

export type FacetKey = "medium" | "project" | "year";
export type FilterKey = FacetKey | "tag";
export type Filters = Partial<Record<FilterKey, string>>;
export type View = "grid" | "index";

/** What a single work offers to filter on, as stable slugs. */
export interface WorkFacets {
  medium?: string;
  project?: string;
  year?: string;
  tags: string[];
}

export interface FacetOption {
  slug: string;
  label: string;
  count: number;
  active: boolean;
}
export interface FacetSection {
  key: FacetKey;
  title: string;
  options: FacetOption[];
}

const FACETS: FacetKey[] = ["medium", "project", "year"];
const FILTER_KEYS: FilterKey[] = ["medium", "project", "year", "tag"];
const DEFAULT_TITLES: Record<FacetKey, string> = { medium: "Medium", project: "Project", year: "Year" };

const detailValue = (work: PublicWork, key: FacetKey) => work.details.find((d) => d.key === key)?.value.trim() ?? "";

/** The year in a Year detail, which may be written as "2024", "c. 2019" or "Spring 2021". */
const yearIn = (value: string) => /\b(1[89]\d\d|20\d\d)\b/.exec(value)?.[1];

/** The text and slug a work has for a facet, or null when it has none. */
function facetValue(work: PublicWork, key: FacetKey): { slug: string; label: string } | null {
  const raw = detailValue(work, key);
  if (!raw) return null;
  if (key === "year") {
    const year = yearIn(raw);
    return year ? { slug: year, label: year } : null;
  }
  return { slug: tagSlug(raw), label: raw.replace(/\s+/g, " ") };
}

export function facetsOf(work: PublicWork): WorkFacets {
  const facets: WorkFacets = { tags: work.tags.map((t) => t.slug) };
  for (const key of FACETS) {
    const value = facetValue(work, key);
    if (value) facets[key] = value.slug;
  }
  return facets;
}

/** Filters from a query string such as `?medium=oil&year=2024`. Unknown or empty entries are ignored. */
export function parseFilters(search: string | URLSearchParams): Filters {
  const params = typeof search === "string" ? new URLSearchParams(search) : search;
  const filters: Filters = {};
  for (const key of FILTER_KEYS) {
    const value = params.get(key)?.trim().toLowerCase();
    if (value) filters[key] = value;
  }
  return filters;
}

/** True when the work satisfies every active filter. */
export function matches(facets: WorkFacets, filters: Filters): boolean {
  return FILTER_KEYS.every((key) => {
    const wanted = filters[key];
    if (!wanted) return true;
    return key === "tag" ? facets.tags.includes(wanted) : facets[key] === wanted;
  });
}

export const filterWork = (works: PublicWork[], filters: Filters): PublicWork[] =>
  works.filter((w) => matches(facetsOf(w), filters));

const without = (filters: Filters, key: FilterKey): Filters => {
  const rest = { ...filters };
  delete rest[key];
  return rest;
};

/**
 * The filter groups for the side rail. Every value any work has is offered, so alternatives stay visible; each
 * count says how many works would remain if that value were chosen on top of the *other* active filters.
 */
export function buildSections(works: PublicWork[], filters: Filters): FacetSection[] {
  const all = works.map((w) => ({ work: w, facets: facetsOf(w) }));
  const sections: FacetSection[] = [];
  for (const key of FACETS) {
    const options = new Map<string, FacetOption>();
    let title: string | undefined;
    for (const { work, facets } of all) {
      const value = facetValue(work, key);
      if (!value) continue;
      title ??= work.details.find((d) => d.key === key)?.label;
      if (!options.has(value.slug)) options.set(value.slug, { slug: value.slug, label: value.label, count: 0, active: filters[key] === value.slug });
      if (matches(facets, without(filters, key))) options.get(value.slug)!.count += facets[key] === value.slug ? 1 : 0;
    }
    if (options.size === 0) continue;
    const list = [...options.values()].sort((a, b) =>
      key === "year" ? Number(b.slug) - Number(a.slug) : a.label.localeCompare(b.label, undefined, { sensitivity: "base" }),
    );
    sections.push({ key, title: title || DEFAULT_TITLES[key], options: list });
  }
  return sections;
}

/** Choosing a value selects it (replacing any other in that facet); choosing it again clears it. */
export function toggleFilter(filters: Filters, key: FilterKey, slug: string): Filters {
  const next = { ...filters };
  if (next[key] === slug) delete next[key];
  else next[key] = slug;
  return next;
}

/** `?medium=oil&year=2024&view=index` in a fixed order, or an empty string when there is nothing to say. */
export function filtersToQuery(filters: Filters, view: View): string {
  const params = new URLSearchParams();
  for (const key of FILTER_KEYS) if (filters[key]) params.set(key, filters[key]!);
  if (view === "index") params.set("view", "index");
  const text = params.toString();
  return text ? `?${text}` : "";
}

/** The address of a gallery page for these filters and this view, under the site's path prefix. */
export const pageHref = (basePath: string, filters: Filters, view: View): string =>
  `${basePath || "/"}${filtersToQuery(filters, view)}`;

/** The `data-*` attributes a grid tile or index row carries so the in-place filter can read what it offers. */
export function facetAttrs(work: PublicWork): Record<string, string | undefined> {
  const f = facetsOf(work);
  return {
    "data-work": work.slug,
    "data-medium": f.medium,
    "data-project": f.project,
    "data-year": f.year,
    "data-tags": f.tags.length ? f.tags.join(" ") : undefined,
  };
}
