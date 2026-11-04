import { createMiddleware } from "hono/factory";
import { bumpContentVersion } from "@senka/core";
import type { AppEnv } from "./env";

const READS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * Whether a finished request may have changed what the public site shows. Successful writes did. So did writes
 * that failed on the server, because several handlers save in more than one step and the first may have stuck.
 * Rejected requests (4xx) never reach their writes.
 */
export function shouldBump(method: string, status: number): boolean {
  if (READS.has(method)) return false;
  return status < 400 || status >= 500;
}

/** Tells the public site its cached pages are out of date: its cache key includes this version. */
export function bumpOnWrite() {
  return createMiddleware<AppEnv>(async (c, next) => {
    await next();
    if (shouldBump(c.req.method, c.res.status)) await bumpContentVersion(c.env.DB, c.get("siteId"));
  });
}
