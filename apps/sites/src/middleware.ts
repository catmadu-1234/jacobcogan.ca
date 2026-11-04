import { defineMiddleware } from "astro:middleware";
import { env } from "cloudflare:workers";
import { routePage } from "./lib/routing";

/**
 * Works out which site a page request is for, maps a site's own hostname onto its internal route, and serves pages
 * from the edge cache keyed by the site's content version. Shared routes (media, API, assets) skip all this.
 * The decisions live in lib/routing.ts, where they are tested.
 */
export const onRequest = defineMiddleware((context, next) =>
  routePage({
    request: context.request,
    locals: context.locals,
    env,
    // `caches.default` is a Workers extension that the DOM typings don't know about. Pages are only cached in
    // production: while developing (or editing visually in Onlook) every change must show up straight away.
    cache: import.meta.env.PROD ? (caches as unknown as { default?: Cache }).default : undefined,
    ctx: context.locals.cfContext ?? { waitUntil: () => {} },
    buildId: __BUILD_ID__,
    next,
    rewrite: (path) => context.rewrite(path),
  }),
);
