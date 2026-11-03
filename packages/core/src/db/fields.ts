import type { FieldDef } from "../types";
import type { FieldDefInput } from "../validate";
import { slugify } from "../slug";

interface FieldRow {
  id: number; site_id: number; key: string; label: string; type: FieldDef["type"];
  required: number; sort: number; archived: number;
}

const rowToFieldDef = (r: FieldRow): FieldDef => ({
  id: r.id, siteId: r.site_id, key: r.key, label: r.label, type: r.type,
  required: !!r.required, sort: r.sort, archived: !!r.archived,
});

export async function listFieldDefs(
  db: D1Database,
  siteId: number,
  opts: { includeArchived?: boolean } = {},
): Promise<FieldDef[]> {
  const sql = `SELECT * FROM field_defs WHERE site_id = ?${opts.includeArchived ? "" : " AND archived = 0"} ORDER BY sort, id`;
  const { results } = await db.prepare(sql).bind(siteId).all<FieldRow>();
  return results.map(rowToFieldDef);
}

async function getFieldDef(db: D1Database, siteId: number, id: number): Promise<FieldRow | null> {
  return db.prepare("SELECT * FROM field_defs WHERE id = ? AND site_id = ?").bind(id, siteId).first<FieldRow>();
}

export async function createFieldDef(db: D1Database, siteId: number, input: FieldDefInput): Promise<FieldDef> {
  const { results } = await db.prepare("SELECT key, sort FROM field_defs WHERE site_id = ?").bind(siteId).all<{ key: string; sort: number }>();
  const taken = new Set(results.map((r) => r.key));
  const base = slugify(input.label) || "detail";
  let key = base;
  for (let n = 2; taken.has(key); n++) key = `${base}-${n}`;
  const sort = results.reduce((m, r) => Math.max(m, r.sort), 0) + 1;
  const res = await db
    .prepare("INSERT INTO field_defs (site_id, key, label, type, required, sort) VALUES (?, ?, ?, ?, ?, ?)")
    .bind(siteId, key, input.label, input.type, input.required ? 1 : 0, sort)
    .run();
  return rowToFieldDef((await getFieldDef(db, siteId, res.meta.last_row_id as number))!);
}

export async function updateFieldDef(
  db: D1Database,
  siteId: number,
  id: number,
  patch: Partial<FieldDefInput & { archived: boolean }>,
): Promise<FieldDef | null> {
  const cur = await getFieldDef(db, siteId, id);
  if (!cur) return null;
  await db
    .prepare("UPDATE field_defs SET label = ?, type = ?, required = ?, archived = ? WHERE id = ? AND site_id = ?")
    .bind(
      patch.label ?? cur.label,
      patch.type ?? cur.type,
      (patch.required ?? !!cur.required) ? 1 : 0,
      (patch.archived ?? !!cur.archived) ? 1 : 0,
      id,
      siteId,
    )
    .run();
  return rowToFieldDef((await getFieldDef(db, siteId, id))!);
}

export async function reorderFieldDefs(db: D1Database, siteId: number, ids: number[]): Promise<void> {
  const stmt = db.prepare("UPDATE field_defs SET sort = ? WHERE id = ? AND site_id = ?");
  await db.batch(ids.map((id, i) => stmt.bind(i + 1, id, siteId)));
}
