import { Hono } from "hono";
import { SitePatch, updateSite } from "@senka/core";
import type { AppEnv } from "../env";
import { readJson } from "../http";

export const siteRoutes = new Hono<AppEnv>();

siteRoutes.patch("/", async (c) => {
  const body = await readJson(c, SitePatch);
  if (!body.ok) return body.res;
  return c.json(await updateSite(c.env.DB, c.get("siteId"), body.data));
});
