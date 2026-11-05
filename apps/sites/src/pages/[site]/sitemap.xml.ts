import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { listPublicWorks } from "@senka/core";
import { siteForPage } from "../../lib/page";
import { buildSitemap } from "../../lib/sitemap";

export const prerender = false;

export const GET: APIRoute = async ({ params, locals, url }) => {
  const site = await siteForPage(locals.site, params.site, env.DB);
  if (!site) return new Response("Not found", { status: 404 });
  const works = await listPublicWorks(env.DB, site, env.MEDIA_BASE);
  const xml = buildSitemap(url.origin, locals.basePath, works.map((w) => w.slug));
  return new Response(xml, { headers: { "Content-Type": "application/xml; charset=utf-8" } });
};
