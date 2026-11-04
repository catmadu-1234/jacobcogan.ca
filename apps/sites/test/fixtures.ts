import { env } from "cloudflare:test";
import { createWork, createMedia, getSiteBySlug, markMediaReady, setWorkTags, softDeleteWork, updateWork, type Media, type Site } from "@senka/core";

export async function seedSites(): Promise<{ a: Site; b: Site }> {
  const insert = env.DB.prepare("INSERT INTO sites (slug, name, hostname) VALUES (?, ?, ?)");
  await env.DB.batch([insert.bind("site-a", "Site A", null), insert.bind("site-b", "Site B", "art.example.com")]);
  return { a: (await getSiteBySlug(env.DB, "site-a"))!, b: (await getSiteBySlug(env.DB, "site-b"))! };
}

export interface MadeWork {
  workId: number;
  slug: string;
  media: Media[];
}

/** A work with ready media whose files exist in R2 (original = "<id>:original" text). */
export async function makeWork(
  site: Site,
  opts: { title: string; visible?: boolean; deleted?: boolean; pending?: boolean; tags?: string[]; variants?: ("original" | "w480" | "w1200" | "poster")[]; kind?: "image" | "video" },
): Promise<MadeWork> {
  const created = await createWork(env.DB, site.id);
  const saved = (await updateWork(env.DB, site.id, created.id, {
    title: opts.title, visible: opts.visible ?? true, expectedUpdatedAt: created.updatedAt,
  })) as { slug: string };
  const kind = opts.kind ?? "image";
  const variants = opts.variants ?? (kind === "image" ? ["original", "w480"] : ["original", "poster"]);
  const media = (await createMedia(env.DB, site.id, created.id, {
    kind, mime: kind === "image" ? "image/jpeg" : "video/mp4", width: 100, height: 50, bytes: 10, variants,
  }))!;
  for (const v of variants) {
    await env.MEDIA.put(`${site.id}/${media.id}/${v}`, `${media.id}:${v}:0123456789`, {
      httpMetadata: { contentType: v === "original" ? media.mime : "image/webp" },
    });
  }
  const ready = opts.pending ? media : (await markMediaReady(env.DB, site.id, media.id, 10))!;
  if (opts.tags?.length) await setWorkTags(env.DB, site.id, created.id, opts.tags);
  if (opts.deleted) await softDeleteWork(env.DB, site.id, created.id);
  return { workId: created.id, slug: saved.slug, media: [ready] };
}
