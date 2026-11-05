import { Hono } from "hono";
import {
  IdList, WorkPatch, createWork, getWork, listFieldDefs, listMediaForWork, listReadyMediaForSite,
  listWorks, reorderWorks, restoreWork, setWorkTags, softDeleteWork, tagsForWork, updateWork,
  type Media,
} from "@senka/core";
import type { AppEnv } from "../env";
import { notFound, parseId, readJson } from "../http";

export const workRoutes = new Hono<AppEnv>();

workRoutes.get("/", async (c) => {
  const siteId = c.get("siteId");
  const [works, ready] = await Promise.all([
    listWorks(c.env.DB, siteId, { q: c.req.query("q") || undefined, tagSlug: c.req.query("tag") || undefined }),
    listReadyMediaForSite(c.env.DB, siteId),
  ]);
  const byWork = new Map<number, Media[]>();
  for (const m of ready) (byWork.get(m.workId!) ?? byWork.set(m.workId!, []).get(m.workId!)!).push(m);
  return c.json(
    works.map((w) => {
      const media = byWork.get(w.id) ?? [];
      return { ...w, cover: media.find((m) => m.id === w.coverMediaId) ?? media[0] ?? null };
    }),
  );
});

workRoutes.post("/", async (c) => c.json(await createWork(c.env.DB, c.get("siteId")), 201));

workRoutes.put("/order", async (c) => {
  const body = await readJson(c, IdList);
  if (!body.ok) return body.res;
  await reorderWorks(c.env.DB, c.get("siteId"), body.data);
  return c.body(null, 204);
});

workRoutes.get("/:id", async (c) => {
  const id = parseId(c.req.param("id"));
  const siteId = c.get("siteId");
  const work = id === null ? null : await getWork(c.env.DB, siteId, id);
  if (!work) return notFound(c);
  const [media, tags] = await Promise.all([listMediaForWork(c.env.DB, siteId, work.id), tagsForWork(c.env.DB, work.id)]);
  return c.json({ work, media, tags });
});

workRoutes.patch("/:id", async (c) => {
  const id = parseId(c.req.param("id"));
  const siteId = c.get("siteId");
  const db = c.env.DB;
  const current = id === null ? null : await getWork(db, siteId, id);
  if (id === null || !current) return notFound(c);
  const body = await readJson(c, WorkPatch);
  if (!body.ok) return body.res;
  const patch = body.data;

  // A work that shows on the site must have every required detail filled in.
  const visibleAfter = patch.visible ?? current.visible;
  if (current.kind === "work" && visibleAfter && (patch.visible !== undefined || patch.fields !== undefined)) {
    const fields = { ...current.fields, ...(patch.fields ?? {}) };
    const missing = (await listFieldDefs(db, siteId))
      .filter((d) => d.required && !(fields[d.key] ?? "").trim())
      .map((d) => d.label);
    if (missing.length) return c.json({ error: "missing-required", missing }, 400);
  }

  const result = await updateWork(db, siteId, id, patch);
  if (result === null) return notFound(c);
  if (result === "conflict") return c.json({ error: "conflict", work: await getWork(db, siteId, id) }, 409);
  if (patch.tags) await setWorkTags(db, siteId, id, patch.tags);
  return c.json({ work: result, tags: await tagsForWork(db, id) });
});

workRoutes.delete("/:id", async (c) => {
  const id = parseId(c.req.param("id"));
  if (id === null) return notFound(c);
  return (await softDeleteWork(c.env.DB, c.get("siteId"), id)) ? c.body(null, 204) : notFound(c);
});

workRoutes.post("/:id/restore", async (c) => {
  const id = parseId(c.req.param("id"));
  if (id === null) return notFound(c);
  return (await restoreWork(c.env.DB, c.get("siteId"), id)) ? c.body(null, 204) : notFound(c);
});
