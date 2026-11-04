import { createMiddleware } from "hono/factory";
import type { AppEnv } from "./env";

const READS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * Refuses writes that the browser says were triggered from another website. Browsers label every request with
 * Sec-Fetch-Site; other tools send nothing and are not affected. Reads stay open so links into the admin work.
 */
export function rejectCrossSiteWrites() {
  return createMiddleware<AppEnv>(async (c, next) => {
    if (!READS.has(c.req.method) && c.req.header("sec-fetch-site") === "cross-site") {
      return c.json({ error: "cross-site" }, 403);
    }
    await next();
  });
}
