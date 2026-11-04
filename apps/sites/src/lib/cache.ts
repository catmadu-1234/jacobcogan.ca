import type { Site } from "@senka/core";

const BROWSER = "public, max-age=0, must-revalidate";
const EDGE = "public, s-maxage=86400";

/**
 * The cache key for a page. It includes the site's content version, which the admin bumps on every change, so
 * publishing makes every old page unreachable without purging anything. It also includes the build id, so
 * deploying new code does too: a cached page from an older build would point at asset files that no longer
 * exist. The hostname is included because pages contain absolute URLs.
 */
export function versionCacheKey(site: Pick<Site, "id" | "contentVersion">, url: URL, buildId = ""): string {
  return `https://cache.senka.invalid/${url.hostname}/${site.id}/${site.contentVersion}/${buildId}${url.pathname}${url.search}`;
}

/**
 * Serves a rendered page from the edge cache when this exact version of the site was rendered before.
 * Only successful, cookie-free GET responses are stored. `cache` is undefined where there is no Cache API.
 */
export async function withVersionCache(
  cache: Cache | undefined,
  request: Request,
  site: Pick<Site, "id" | "contentVersion">,
  ctx: { waitUntil(promise: Promise<unknown>): void },
  render: () => Promise<Response>,
  /** Identifies the deployed build; a different build never reuses another build's pages. */
  buildId = "",
): Promise<Response> {
  if (request.method !== "GET" || !cache) return render();

  const key = new Request(versionCacheKey(site, new URL(request.url), buildId));
  const hit = await cache.match(key);
  if (hit) return withHeaders(hit, "HIT");

  const response = await render();
  if (response.status === 200 && !response.headers.has("set-cookie")) {
    const stored = new Response(response.clone().body, response);
    stored.headers.set("Cache-Control", EDGE);
    ctx.waitUntil(cache.put(key, stored));
  }
  return withHeaders(response, "MISS");
}

function withHeaders(response: Response, state: "HIT" | "MISS"): Response {
  const out = new Response(response.body, response);
  out.headers.set("Cache-Control", BROWSER);
  out.headers.set("X-Cache", state);
  return out;
}
