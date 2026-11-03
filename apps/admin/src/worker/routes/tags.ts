import { Hono } from "hono";
import { z } from "zod";
import { deleteTag, listTags, renameTag } from "@senka/core";
import type { AppEnv } from "../env";
import { notFound, parseId, readJson } from "../http";

const TagRename = z.object({ name: z.string().trim().min(1).max(40) });

export const tagRoutes = new Hono<AppEnv>();

tagRoutes.get("/", async (c) => c.json(await listTags(c.env.DB, c.get("siteId"))));

tagRoutes.patch("/:id", async (c) => {
  const id = parseId(c.req.param("id"));
  if (id === null) return notFound(c);
  const body = await readJson(c, TagRename);
  if (!body.ok) return body.res;
  const tag = await renameTag(c.env.DB, c.get("siteId"), id, body.data.name);
  return tag ? c.json(tag) : notFound(c);
});

tagRoutes.delete("/:id", async (c) => {
  const id = parseId(c.req.param("id"));
  if (id === null) return notFound(c);
  return (await deleteTag(c.env.DB, c.get("siteId"), id)) ? c.body(null, 204) : notFound(c);
});
