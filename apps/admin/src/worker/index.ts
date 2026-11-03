import { Hono } from "hono";
import type { JWTVerifyGetKey } from "jose";
import { bumpContentVersion, getSiteById, storageBytes } from "@senka/core";
import { accessAuth } from "./auth";
import { runCleanup } from "./cron";
import type { AppEnv } from "./env";
import { fieldRoutes } from "./routes/fields";
import { mediaRoutes } from "./routes/media";
import { siteRoutes } from "./routes/site";
import { tagRoutes } from "./routes/tags";
import { workRoutes } from "./routes/works";

import type { Env } from "./env";

export type { AppEnv, Env } from "./env";

export function createApp(opts: { getKey?: JWTVerifyGetKey } = {}) {
  const api = new Hono<AppEnv>();
  api.use("*", accessAuth(opts));
  // Any successful write invalidates the public site's cache, which is keyed by this version.
  api.use("*", async (c, next) => {
    await next();
    if (c.req.method !== "GET" && c.res.status < 400) await bumpContentVersion(c.env.DB, c.get("siteId"));
  });

  api.get("/me", async (c) => {
    const siteId = c.get("siteId");
    const [site, bytes] = await Promise.all([getSiteById(c.env.DB, siteId), storageBytes(c.env.DB, siteId)]);
    return c.json({ email: c.get("email"), site, storageBytes: bytes });
  });

  api.route("/site", siteRoutes);
  api.route("/fields", fieldRoutes);
  api.route("/works", workRoutes);
  api.route("/tags", tagRoutes);
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
