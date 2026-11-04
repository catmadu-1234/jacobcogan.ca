import type { Site } from "@senka/core";
import { withVersionCache } from "./cache";
import { isSharedPath, resolveSiteFromRequest, rewritePath } from "./site";

export interface RoutingLocals {
  basePath: string;
  site?: Site;
  publicUrl?: string;
  rewritten?: boolean;
}

export interface RoutingArgs {
  request: Request;
  locals: RoutingLocals;
  env: { DB: D1Database };
  cache: Cache | undefined;
  ctx: { waitUntil(promise: Promise<unknown>): void };
  buildId: string;
  next: () => Promise<Response>;
  rewrite: (path: string) => Promise<Response>;
}

/**
 * Decides which site a page request belongs to and where it is rendered. A site on its own domain is rewritten to
 * its internal route (/<slug>/...). Astro runs the middleware again on the rewritten request, with the same
 * `locals`, so that second pass must change nothing: rewriting again would loop forever.
 */
export async function routePage(a: RoutingArgs): Promise<Response> {
  const { request, locals } = a;
  if (locals.rewritten) return a.next();

  locals.basePath = "";
  // Astro swaps its request for the internal route after a rewrite; keep the address the visitor used.
  locals.publicUrl ??= request.url;
  const url = new URL(request.url);
  if (isSharedPath(url.pathname)) return a.next();

  const resolved = await resolveSiteFromRequest(a.env.DB, url);
  if (!resolved) return a.next();

  locals.site = resolved.site;
  locals.basePath = resolved.basePath;
  const target = rewritePath(url.pathname, resolved.site.slug, resolved.basePath);
  const render = () => {
    if (!target) return a.next();
    locals.rewritten = true;
    return a.rewrite(target + url.search);
  };
  return withVersionCache(a.cache, request, resolved.site, a.ctx, render, a.buildId);
}
