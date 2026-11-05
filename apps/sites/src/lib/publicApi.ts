import { getPublicWork, getSiteBySlug, listPublicWorks } from "@senka/core";
import { filterWork, parseFilters } from "./filters";

export interface ApiEnv {
  DB: D1Database;
  MEDIA_BASE?: string;
}

const mediaBase = (env: ApiEnv) => env.MEDIA_BASE ?? "/media";

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": status === 200 ? "public, max-age=60" : "no-store",
    },
  });
}
const notFound = () => json({ error: "not-found" }, 404);

/** GET /api/public/:site/works[?medium=&project=&content=&exhibition=&year=] — everything visible on the site, in display order. */
export async function handlePublicWorks(env: ApiEnv, siteSlug: string, url: URL): Promise<Response> {
  const site = await getSiteBySlug(env.DB, siteSlug);
  if (!site) return notFound();
  const works = filterWork(await listPublicWorks(env.DB, site, mediaBase(env)), parseFilters(url.searchParams));
  return json({ site: { name: site.name, slug: site.slug }, works });
}

/** GET /api/public/:site/works/:slug — one visible work with its neighbours. */
export async function handlePublicWork(env: ApiEnv, siteSlug: string, workSlug: string): Promise<Response> {
  const site = await getSiteBySlug(env.DB, siteSlug);
  if (!site) return notFound();
  const found = await getPublicWork(env.DB, site, workSlug, mediaBase(env));
  return found ? json(found) : notFound();
}
