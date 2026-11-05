import { Hono } from "hono";
import { createWork, listMediaForWork, listWorks, type Media } from "@senka/core";
import type { AppEnv } from "../env";

/** The Studio feed: short posts that are a photo, a clip, a few words, or any mix. Edited through the works routes. */
export const studioRoutes = new Hono<AppEnv>();

studioRoutes.get("/", async (c) => {
  const siteId = c.get("siteId");
  const posts = await listWorks(c.env.DB, siteId, { kind: "post" });
  const media = await Promise.all(posts.map((p) => listMediaForWork(c.env.DB, siteId, p.id)));
  return c.json(posts.map((p, i) => ({ ...p, media: media[i] as Media[] })));
});

studioRoutes.post("/", async (c) => c.json(await createWork(c.env.DB, c.get("siteId"), "post"), 201));
