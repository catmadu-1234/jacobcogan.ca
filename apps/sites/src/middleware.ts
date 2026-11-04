import { defineMiddleware } from "astro:middleware";
import { env } from "cloudflare:workers";
import { withVersionCache } from "./lib/cache";
import { isSharedPath, resolveSiteFromRequest, rewritePath } from "./lib/site";

/**
 * Works out which site a page request is for, maps a site's own hostname onto its internal route, and serves
 * pages from the edge cache keyed by the site's content version. Shared routes (media, API, assets) skip all this.
 */
export const onRequest = defineMiddleware(async (context, next) => {
  context.locals.basePath = "";
  const url = new URL(context.request.url);
  if (isSharedPath(url.pathname)) return next();

  const resolved = await resolveSiteFromRequest(env.DB, url);
  if (!resolved) return next();

  context.locals.site = resolved.site;
  context.locals.basePath = resolved.basePath;
  const target = rewritePath(url.pathname, resolved.site.slug, resolved.basePath);
  const render = () => (target ? context.rewrite(target + url.search) : next());

  const ctx = context.locals.cfContext ?? { waitUntil: () => {} };
  // `caches.default` is a Workers extension that the DOM typings don't know about.
  const cache = (caches as unknown as { default?: Cache }).default;
  return withVersionCache(cache, context.request, resolved.site, ctx, render);
});
