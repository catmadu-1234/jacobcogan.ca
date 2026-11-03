import { Hono } from "hono";
import { z } from "zod";
import {
  FieldDefInput, IdList, createFieldDef, listFieldDefs, reorderFieldDefs, updateFieldDef,
} from "@senka/core";
import type { AppEnv } from "../env";
import { notFound, parseId, readJson } from "../http";

const FieldDefPatch = FieldDefInput.partial().extend({ archived: z.boolean().optional() });

export const fieldRoutes = new Hono<AppEnv>();

fieldRoutes.get("/", async (c) => c.json(await listFieldDefs(c.env.DB, c.get("siteId"), { includeArchived: true })));

fieldRoutes.post("/", async (c) => {
  const body = await readJson(c, FieldDefInput);
  if (!body.ok) return body.res;
  return c.json(await createFieldDef(c.env.DB, c.get("siteId"), body.data), 201);
});

fieldRoutes.put("/order", async (c) => {
  const body = await readJson(c, IdList);
  if (!body.ok) return body.res;
  await reorderFieldDefs(c.env.DB, c.get("siteId"), body.data);
  return c.body(null, 204);
});

fieldRoutes.patch("/:id", async (c) => {
  const id = parseId(c.req.param("id"));
  if (id === null) return notFound(c);
  const body = await readJson(c, FieldDefPatch);
  if (!body.ok) return body.res;
  const updated = await updateFieldDef(c.env.DB, c.get("siteId"), id, body.data);
  return updated ? c.json(updated) : notFound(c);
});
