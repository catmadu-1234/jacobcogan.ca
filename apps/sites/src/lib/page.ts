import { getSiteBySlug, type Site } from "@senka/core";

/**
 * The site a page route should render, or null (→ 404). It must match the slug in the URL, so a request that the
 * middleware resolved to one site can never show another site's pages.
 */
export async function siteForPage(resolved: Site | undefined, slug: string | undefined, db: D1Database): Promise<Site | null> {
  if (!slug) return null;
  const site = resolved ?? (await getSiteBySlug(db, slug));
  return site && site.slug === slug ? site : null;
}

/** A short plain-text summary for search results and link previews. */
export function describe(text: string, fallback: string): string {
  const flat = text.replace(/\s+/g, " ").trim();
  if (!flat) return fallback;
  return flat.length <= 155 ? flat : `${flat.slice(0, 154).trimEnd()}…`;
}
