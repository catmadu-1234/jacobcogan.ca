import { Hono } from "hono";
import type { JWTVerifyGetKey } from "jose";
import { getSiteById, storageBytes } from "@senka/core";
import { accessAuth, openSideRoutes } from "./auth";
import { bumpOnWrite } from "./bump";
import { runCleanup } from "./cron";
import type { AppEnv } from "./env";
import { rejectCrossSiteWrites } from "./guard";
import { fieldRoutes } from "./routes/fields";
import { mediaRoutes } from "./routes/media";
import { siteRoutes } from "./routes/site";
import { studioRoutes } from "./routes/studio";
import { facetRoutes } from "./routes/facets";
import { workRoutes } from "./routes/works";

import type { Env } from "./env";

export type { AppEnv, Env } from "./env";

export function createApp(opts: { getKey?: JWTVerifyGetKey } = {}) {
  const api = new Hono<AppEnv>();
  api.route("/", openSideRoutes); // before the login check: choosing a side is how you get in
  api.use("*", accessAuth(opts));
  api.use("*", rejectCrossSiteWrites());
  // Any write invalidates the public site's cache, which is keyed by this version.
  api.use("*", bumpOnWrite());

  api.get("/me", async (c) => {
    const siteId = c.get("siteId");
    const [site, bytes] = await Promise.all([getSiteById(c.env.DB, siteId), storageBytes(c.env.DB, siteId)]);
    return c.json({ email: c.get("email"), site, storageBytes: bytes });
  });

  api.route("/site", siteRoutes);
  api.route("/fields", fieldRoutes);
  api.route("/works", workRoutes);
  api.route("/studio", studioRoutes);
  api.route("/facets", facetRoutes);
  api.route("/", mediaRoutes);

  const app = new Hono<AppEnv>();
  app.route("/api", api);
  // Hono only honours notFound on the top-level app, not on mounted sub-apps.
  app.notFound((c) => c.json({ error: "not-found" }, 404));
  app.onError((err, c) => {
    console.error(err);
    return c.json({ error: "server" }, 500);
  });
  return app;
}

const app = createApp();

export default {
  fetch: app.fetch,
  scheduled(_event: ScheduledController, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(runCleanup(env));
  },
};
