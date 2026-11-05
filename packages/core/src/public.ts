import { type Facet, type FieldType, type Media, type MediaVariant, type Site } from "./types";
import { rowToMedia } from "./db/media";

export interface PublicMedia {
  kind: "image" | "video"; width: number; height: number; color: string | null; alt: string;
  duration: number | null; src: string; srcset: string | null; poster: string | null;
  /** The untouched original, for opening full size. */
  full: string;
}
export interface PublicWork {
  slug: string; title: string;
  details: { key: string; label: string; value: string; type: FieldType }[];
  /** Medium, Project, Content and Exhibition values, each with the name to show and the slug to filter by. */
  facets: Record<Facet, { name: string; slug: string }[]>;
  media: PublicMedia[]; cover: PublicMedia | null; updatedAt: string;
}

const WIDTHS: Array<[MediaVariant, number]> = [["w480", 480], ["w1200", 1200], ["w2400", 2400]];

export function toPublicMedia(m: Media, mediaBase: string): PublicMedia {
  const url = (v: MediaVariant) => `${mediaBase}/${m.siteId}/${m.id}/${v}`;
  const has = (v: MediaVariant) => m.variants.includes(v);
  let src = url("original");
  let srcset: string | null = null;
  if (m.kind === "image") {
    const widths = WIDTHS.filter(([v]) => has(v));
    if (widths.length) {
      srcset = widths.map(([v, w]) => `${url(v)} ${w}w`).join(", ");
      src = url(widths[widths.length - 1]![0]);
    }
  }
  return {
    kind: m.kind, width: m.width, height: m.height, color: m.color, alt: m.alt, duration: m.duration,
    src, srcset, poster: m.kind === "video" && has("poster") ? url("poster") : null, full: url("original"),
  };
}

interface PubWorkRow { id: number; slug: string; title: string; fields_json: string; cover_media_id: number | null; updated_at: string }
interface DefRow { key: string; label: string; type: FieldType }
interface FacetJoinRow { work_id: number; facet: Facet; name: string; slug: string }

const VISIBLE = "w.site_id = ? AND w.kind = 'work' AND w.visible = 1 AND w.deleted_at IS NULL";
const DEFS_SQL = "SELECT key, label, type FROM field_defs WHERE site_id = ? AND archived = 0 ORDER BY sort, id";

function build(row: PubWorkRow, media: Media[], values: FacetJoinRow[], defs: DefRow[], base: string): PublicWork {
  const fields: Record<string, string> = JSON.parse(row.fields_json);
  const pub = media.map((m) => toPublicMedia(m, base));
  const coverIndex = media.findIndex((m) => m.id === row.cover_media_id);
  return {
    slug: row.slug,
    title: row.title,
    details: defs.filter((d) => (fields[d.key] ?? "").trim() !== "").map((d) => ({ key: d.key, label: d.label, value: fields[d.key]!, type: d.type })),
    facets: facetsOf(values),
    media: pub,
    cover: pub[coverIndex >= 0 ? coverIndex : 0] ?? null,
    updatedAt: row.updated_at,
  };
}

function facetsOf(values: FacetJoinRow[]): PublicWork["facets"] {
  const facets: PublicWork["facets"] = { medium: [], project: [], content: [], exhibition: [] };
  for (const v of values) facets[v.facet].push({ name: v.name, slug: v.slug });
  return facets;
}

function groupBy<T>(rows: T[], key: (r: T) => number): Map<number, T[]> {
  const map = new Map<number, T[]>();
  for (const r of rows) (map.get(key(r)) ?? map.set(key(r), []).get(key(r))!).push(r);
  return map;
}

/** One D1 round trip: works, ready media, tags and detail definitions for the whole site. */
export async function listPublicWorks(
  db: D1Database,
  site: Site,
  mediaBase: string,
)
: Promise<PublicWork[]> {
  const [works, media, values, defs] = await db.batch([
    db.prepare(`SELECT w.* FROM works w WHERE ${VISIBLE} ORDER BY w.sort ASC, w.id DESC`).bind(site.id),
    db.prepare(`SELECT m.* FROM media m JOIN works w ON w.id = m.work_id WHERE ${VISIBLE} AND m.status = 'ready' ORDER BY m.work_id, m.sort, m.id`).bind(site.id),
    db.prepare(`SELECT l.work_id, fv.facet, fv.name, fv.slug FROM work_facet_values l JOIN facet_values fv ON fv.id = l.value_id JOIN works w ON w.id = l.work_id WHERE ${VISIBLE} ORDER BY fv.name COLLATE NOCASE`).bind(site.id),
    db.prepare(DEFS_SQL).bind(site.id),
  ]);
  const mediaByWork = groupBy((media!.results as any[]).map(rowToMedia), (m) => m.workId!);
  const valuesByWork = groupBy(values!.results as unknown as FacetJoinRow[], (t) => t.work_id);
  return (works!.results as unknown as PubWorkRow[])
    .filter((w) => (mediaByWork.get(w.id)?.length ?? 0) > 0)
    .map((w) => build(w, mediaByWork.get(w.id)!, valuesByWork.get(w.id) ?? [], defs!.results as unknown as DefRow[], mediaBase));
}

export async function getPublicWork(
  db: D1Database,
  site: Site,
  slug: string,
  mediaBase: string,
): Promise<{ work: PublicWork; prev: { slug: string; title: string } | null; next: { slug: string; title: string } | null } | null> {
  const bySlug = `${VISIBLE} AND w.slug = ?`;
  const [work, nav, media, values, defs] = await db.batch([
    db.prepare(`SELECT w.* FROM works w WHERE ${bySlug}`).bind(site.id, slug),
    db.prepare(
      `SELECT w.slug, w.title FROM works w WHERE ${VISIBLE}
       AND EXISTS (SELECT 1 FROM media m WHERE m.work_id = w.id AND m.status = 'ready') ORDER BY w.sort ASC, w.id DESC`,
    ).bind(site.id),
    db.prepare(`SELECT m.* FROM media m JOIN works w ON w.id = m.work_id WHERE ${bySlug} AND m.status = 'ready' ORDER BY m.sort, m.id`).bind(site.id, slug),
    db.prepare(`SELECT l.work_id, fv.facet, fv.name, fv.slug FROM work_facet_values l JOIN facet_values fv ON fv.id = l.value_id JOIN works w ON w.id = l.work_id WHERE ${bySlug} ORDER BY fv.name COLLATE NOCASE`).bind(site.id, slug),
    db.prepare(DEFS_SQL).bind(site.id),
  ]);
  const row = (work!.results as unknown as PubWorkRow[])[0];
  const readyMedia = (media!.results as any[]).map(rowToMedia);
  if (!row || readyMedia.length === 0) return null;
  const list = nav!.results as unknown as { slug: string; title: string }[];
  const i = list.findIndex((w) => w.slug === slug);
  return {
    work: build(row, readyMedia, values!.results as unknown as FacetJoinRow[], defs!.results as unknown as DefRow[], mediaBase),
    prev: i > 0 ? list[i - 1]! : null,
    next: i >= 0 && i < list.length - 1 ? list[i + 1]! : null,
  };
}

/** One Studio entry: some words, some pictures or clips, or both. */
export interface PublicPost {
  id: number; createdAt: string; body: string; media: PublicMedia[];
}

interface PubPostRow { id: number; created_at: string; body: string }

/** The Studio feed, newest first. A post shows if it has words or at least one finished upload. */
export async function listPublicPosts(db: D1Database, site: Site, mediaBase: string): Promise<PublicPost[]> {
  const where = "w.site_id = ? AND w.kind = 'post' AND w.visible = 1 AND w.deleted_at IS NULL";
  const [posts, media] = await db.batch([
    db.prepare(`SELECT w.id, w.created_at, w.body FROM works w WHERE ${where} ORDER BY w.created_at DESC, w.id DESC`).bind(site.id),
    db.prepare(`SELECT m.* FROM media m JOIN works w ON w.id = m.work_id WHERE ${where} AND m.status = 'ready' ORDER BY m.work_id, m.sort, m.id`).bind(site.id),
  ]);
  const mediaByPost = groupBy((media!.results as any[]).map(rowToMedia), (m) => m.workId!);
  return (posts!.results as unknown as PubPostRow[])
    .map((p) => ({
      id: p.id,
      createdAt: p.created_at,
      body: p.body,
      media: (mediaByPost.get(p.id) ?? []).map((m) => toPublicMedia(m, mediaBase)),
    }))
    .filter((p) => p.body.trim() !== "" || p.media.length > 0);
}
