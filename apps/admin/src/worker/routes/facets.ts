import { Hono } from "hono";
import { z } from "zod";
import { listFacetValues, renameFacetValue } from "@senka/core";
import type { AppEnv } from "../env";
import { notFound, parseId, readJson } from "../http";

const Rename = z.object({ name: z.string().trim().min(1).max(40) });

export const facetRoutes = new Hono<AppEnv>();

/** The values this site's works already carry for each facet, for suggestions while editing. */
facetRoutes.get("/", async (c) => c.json(await listFacetValues(c.env.DB, c.get("siteId"))));

/** Renames a value for every work that uses it; matching another value of the same facet merges the two. */
facetRoutes.patch("/:id", async (c) => {
  const id = parseId(c.req.param("id"));
  if (id === null) return notFound(c);
  const body = await readJson(c, Rename);
  if (!body.ok) return body.res;
  const value = await renameFacetValue(c.env.DB, c.get("siteId"), id, body.data.name);
  return value ? c.json(value) : notFound(c);
});
