import { getSiteByHostname, getSiteBySlug, type Site } from "@senka/core";

/** First path segments that belong to shared routes, never to a site (even if a site were given that slug). */
export const RESERVED_SEGMENTS = new Set(["media", "api", "_astro", "robots.txt", "favicon.ico"]);

function firstSegment(pathname: string): string {
  const raw = pathname.split("/")[1] ?? "";
  try {
    return decodeURIComponent(raw);
  } catch {
    return "";
  }
}

export function isSharedPath(pathname: string): boolean {
  return RESERVED_SEGMENTS.has(firstSegment(pathname).toLowerCase());
}

/**
 * Which site a request is for: its own hostname (no path prefix), otherwise the first path segment as a slug
 * on the shared address. The hostname wins when both could apply.
 */
export async function resolveSiteFromRequest(
  db: D1Database,
  url: URL,
): Promise<{ site: Site; basePath: string } | null> {
  const byHost = await getSiteByHostname(db, url.hostname);
  if (byHost) return { site: byHost, basePath: "" };
  const segment = firstSegment(url.pathname);
  if (!segment || isSharedPath(url.pathname)) return null;
  const site = await getSiteBySlug(db, segment);
  return site ? { site, basePath: `/${site.slug}` } : null;
}

/** For a site on its own hostname, the internal route its page lives at; null when no rewrite applies. */
export function rewritePath(pathname: string, slug: string, basePath: string): string | null {
  if (basePath !== "" || isSharedPath(pathname)) return null;
  return `/${slug}${pathname === "/" ? "" : pathname}`;
}
