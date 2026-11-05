export async function seedTwoSites(db: D1Database): Promise<{ a: number; b: number }> {
  const insertSite = db.prepare("INSERT INTO sites (slug, name) VALUES (?, ?)");
  const [ra, rb] = await db.batch([insertSite.bind("site-a", "Site A"), insertSite.bind("site-b", "Site B")]);
  const a = ra.meta.last_row_id as number;
  const b = rb.meta.last_row_id as number;
  const insertUser = db.prepare("INSERT INTO users (email, site_id) VALUES (?, ?)");
  await db.batch([insertUser.bind("a@test.dev", a), insertUser.bind("b@test.dev", b)]);
  return { a, b };
}

import {
  createWork, updateWork, createMedia, updateMedia, setWorkFacets,
  type Facet, type Media, type MediaVariant, type Work,
} from "../src";

export interface AddWorkOptions {
  title: string;
  kind?: "work" | "post";
  body?: string;
  visible?: boolean;
  fields?: Record<string, string>;
  facets?: Partial<Record<Facet, string[]>>;
  media?: Array<{ kind?: "image" | "video"; variants?: MediaVariant[]; ready?: boolean; width?: number; height?: number }>;
}

/** Creates a work (visible by default) with media rows; media is `ready` unless `ready: false`. */
export async function addWork(
  db: D1Database,
  siteId: number,
  opts: AddWorkOptions,
): Promise<{ work: Work; media: Media[] }> {
  const created = await createWork(db, siteId, opts.kind);
  const saved = await updateWork(db, siteId, created.id, {
    title: opts.title,
    body: opts.body,
    visible: opts.visible ?? true,
    fields: opts.fields,
    expectedUpdatedAt: created.updatedAt,
  });
  if (saved === "conflict" || saved === null) throw new Error("addWork: could not save");
  const media: Media[] = [];
  for (const m of opts.media ?? [{}]) {
    const kind = m.kind ?? "image";
    let row = await createMedia(db, siteId, saved.id, {
      kind,
      mime: kind === "image" ? ("image/webp" as const) : ("video/mp4" as const),
      width: m.width ?? 1200,
      height: m.height ?? 800,
      bytes: 1000,
      variants: m.variants ?? (kind === "image" ? ["original", "w480", "w1200"] : ["original", "poster"]),
    });
    if (!row) throw new Error("addWork: createMedia failed");
    if (m.ready !== false) row = (await updateMedia(db, siteId, row.id, { status: "ready" }))!;
    media.push(row);
  }
  if (opts.facets) await setWorkFacets(db, siteId, saved.id, opts.facets);
  return { work: saved, media };
}
