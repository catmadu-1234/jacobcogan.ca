import { getSiteByHostname, type Site } from "@senka/core";
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
/** The domain a forwarder says the visitor used, or null. Only a plain hostname is accepted. */
export function forwardedHost(request: Request): string | null {
  const value = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim().toLowerCase();
  return value && value.length <= 253 && /^[a-z0-9]([a-z0-9.-]*[a-z0-9])?$/.test(value) ? value : null;
}

export async function routePage(a: RoutingArgs): Promise<Response> {
  const { request, locals } = a;
  if (locals.rewritten) return a.next();

  locals.basePath = "";
  const url = new URL(request.url);
  // A forwarder on the owner's own domain (see apps/forwarder) passes the address the visitor typed.
  const forwarded = forwardedHost(request);
  if (forwarded) {
    url.protocol = "https:";
    url.port = "";
    url.hostname = forwarded;
  }
  // Astro swaps its request for the internal route after a rewrite; keep the address the visitor used.
  locals.publicUrl ??= url.toString();

  // `www.` of a site's own domain sends visitors to the bare domain, so the portfolio has one address.
  if (url.hostname.startsWith("www.")) {
    const bare = url.hostname.slice(4);
    if (await getSiteByHostname(a.env.DB, bare)) {
      url.hostname = bare;
      return Response.redirect(url.toString(), 301);
    }
  }
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
  // Pages are cached under the address the visitor used, since they contain absolute URLs.
  return withVersionCache(a.cache, forwarded ? new Request(url, request) : request, resolved.site, a.ctx, render, a.buildId);
}
