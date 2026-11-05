// The rules for filtering a gallery by Medium, Project, Content, Exhibition and Year. Used by the server when it
// renders a page and by the small script that filters in place in the browser, so both always agree. Nothing here
// may import server-only code: only types and the pure slug helper.
import type { PublicWork } from "@senka/core";

export type TagFacetKey = "medium" | "project" | "content" | "exhibition";
export type FacetKey = TagFacetKey | "year";
export type FilterKey = FacetKey;
export type Filters = Partial<Record<FilterKey, string>>;
export type View = "grid" | "index";

/** What a single work offers to filter on, as stable slugs. A work can have several of each tag-style facet. */
export interface WorkFacets {
  medium: string[];
  project: string[];
  content: string[];
  exhibition: string[];
  year?: string;
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

export const TAG_FACETS: TagFacetKey[] = ["medium", "project", "content", "exhibition"];
const FILTER_KEYS: FilterKey[] = [...TAG_FACETS, "year"];
const TITLES: Record<FacetKey, string> = { medium: "Medium", project: "Project", content: "Content", exhibition: "Exhibition", year: "Year" };

/** The year in a Year detail, which should be four digits but may be older free text such as "c. 2019". */
const yearIn = (value: string) => /\b(1[89]\d\d|20\d\d)\b/.exec(value)?.[1];

/** Every value a work has for a facet, as slug and label. */
function facetValues(work: PublicWork, key: FacetKey): { slug: string; label: string }[] {
  if (key === "year") {
    const year = yearIn(work.details.find((d) => d.key === "year")?.value.trim() ?? "");
    return year ? [{ slug: year, label: year }] : [];
  }
  return work.facets[key].map((v) => ({ slug: v.slug, label: v.name }));
}

export function facetsOf(work: PublicWork): WorkFacets {
  const facets: WorkFacets = { medium: [], project: [], content: [], exhibition: [] };
  for (const key of FILTER_KEYS) {
    const slugs = facetValues(work, key).map((v) => v.slug);
    if (key === "year") facets.year = slugs[0];
    else facets[key] = slugs;
  }
  return facets;
}

/** True when the work has this value for the facet. */
export const has = (facets: WorkFacets, key: FacetKey, slug: string): boolean =>
  key === "year" ? facets.year === slug : facets[key].includes(slug);

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
    return !wanted || has(facets, key, wanted);
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
  for (const key of FILTER_KEYS) {
    const options = new Map<string, FacetOption>();
    for (const { work, facets } of all) {
      for (const value of facetValues(work, key)) {
        if (!options.has(value.slug)) options.set(value.slug, { slug: value.slug, label: value.label, count: 0, active: filters[key] === value.slug });
        if (matches(facets, without(filters, key))) options.get(value.slug)!.count += 1;
      }
    }
    if (options.size === 0) continue;
    const list = [...options.values()].sort((a, b) =>
      key === "year" ? Number(b.slug) - Number(a.slug) : a.label.localeCompare(b.label, undefined, { sensitivity: "base" }),
    );
    sections.push({ key, title: TITLES[key], options: list });
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
  const list = (slugs: string[]) => (slugs.length ? slugs.join(" ") : undefined);
  return {
    "data-work": work.slug,
    "data-medium": list(f.medium),
    "data-project": list(f.project),
    "data-content": list(f.content),
    "data-exhibition": list(f.exhibition),
    "data-year": f.year,
  };
}
