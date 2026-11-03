import { Hono } from "hono";
import type { JWTVerifyGetKey } from "jose";
import { getSiteById, storageBytes } from "@senka/core";
import { accessAuth } from "./auth";
import type { AppEnv } from "./env";

export type { AppEnv, Env } from "./env";

export function createApp(opts: { getKey?: JWTVerifyGetKey } = {}) {
  const api = new Hono<AppEnv>();
  api.use("*", accessAuth(opts));

  api.get("/me", async (c) => {
    const siteId = c.get("siteId");
    const [site, bytes] = await Promise.all([getSiteById(c.env.DB, siteId), storageBytes(c.env.DB, siteId)]);
    return c.json({ email: c.get("email"), site, storageBytes: bytes });
  });

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

export default { fetch: app.fetch };
