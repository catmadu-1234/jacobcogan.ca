import type { PublicWork } from "@senka/core";

export interface TagSummary {
  name: string;
  slug: string;
  count: number;
}

/** The tags in use across the visible works, with how many works use each, sorted by name. */
export function collectTags(works: PublicWork[]): TagSummary[] {
  const bySlug = new Map<string, TagSummary>();
  for (const work of works) {
    for (const tag of work.tags) {
      const entry = bySlug.get(tag.slug);
      if (entry) entry.count++;
      else bySlug.set(tag.slug, { name: tag.name, slug: tag.slug, count: 1 });
    }
  }
  return [...bySlug.values()].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
}
