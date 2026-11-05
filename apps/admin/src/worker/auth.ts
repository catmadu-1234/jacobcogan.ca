import { createMiddleware } from "hono/factory";
import { getCookie } from "hono/cookie";
import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from "jose";
import { getSiteBySlug, getUserSiteId } from "@senka/core";
import { Hono } from "hono";
import type { AppEnv } from "./env";

let remote: { team: string; keys: JWTVerifyGetKey } | null = null;

/** The remote key set is cached at module scope so its fetched keys are reused across requests. */
function remoteKeys(team: string): JWTVerifyGetKey {
  if (!remote || remote.team !== team) {
    remote = { team, keys: createRemoteJWKSet(new URL(`https://${team}/cdn-cgi/access/certs`)) };
  }
  return remote.keys;
}

const isLocalHost = (host: string) => host === "localhost" || host === "127.0.0.1";

async function emailFromAccessToken(
  token: string | undefined,
  env: AppEnv["Bindings"],
  getKey?: JWTVerifyGetKey,
): Promise<string | null> {
  // Fail closed: without a team domain and audience there is nothing safe to verify against.
  if (!token || !env.ACCESS_TEAM_DOMAIN || !env.ACCESS_AUD) return null;
  try {
    const { payload } = await jwtVerify(token, getKey ?? remoteKeys(env.ACCESS_TEAM_DOMAIN), {
      issuer: `https://${env.ACCESS_TEAM_DOMAIN}`,
      audience: env.ACCESS_AUD,
    });
    return typeof payload.email === "string" && payload.email ? payload.email : null;
  } catch {
    return null;
  }
}

export function accessAuth(opts: { getKey?: JWTVerifyGetKey } = {}) {
  return createMiddleware<AppEnv>(async (c, next) => {
    const env = c.env;
    const host = new URL(c.req.url).hostname;
    const email =
      env.DEV_USER_EMAIL && isLocalHost(host)
        ? env.DEV_USER_EMAIL
        : await emailFromAccessToken(c.req.header("Cf-Access-Jwt-Assertion"), env, opts.getKey);
    if (!email) {
      if (env.OPEN_SIDES === "1") {
        const siteId = await sideSiteId(c);
        if (siteId === null) return c.json({ error: "choose-side" }, 401);
        c.set("email", "open-sides");
        c.set("siteId", siteId);
        return next();
      }
      return c.json({ error: "unauthenticated" }, 401);
    }

    const siteId = await getUserSiteId(env.DB, email);
    if (siteId === null) return c.json({ error: "no-site" }, 403);

    c.set("email", email);
    c.set("siteId", siteId);
    await next();
  });
}

const SIDE_COOKIE = "senka_side";
const YEAR = 60 * 60 * 24 * 365;

/**
 * Open sides mode, for before there is a login: with OPEN_SIDES set, visitors pick which site they are working on and
 * a cookie remembers it. Anyone who knows the address can edit, so this is only a stopgap until Cloudflare Access is on.
 */
export const openSideRoutes = new Hono<AppEnv>();

openSideRoutes.get("/sides", async (c) => {
  if (c.env.OPEN_SIDES !== "1") return c.json({ error: "not-found" }, 404);
  const { results } = await c.env.DB.prepare("SELECT slug, name FROM sites ORDER BY id").all<{ slug: string; name: string }>();
  return c.json(results);
});

openSideRoutes.get("/side/:slug", async (c) => {
  if (c.env.OPEN_SIDES !== "1") return c.json({ error: "not-found" }, 404);
  if (c.req.header("sec-fetch-site") === "cross-site") return c.json({ error: "cross-site" }, 403);
  const slug = c.req.param("slug");
  const cookie = `${SIDE_COOKIE}=`;
  const attrs = "Path=/; HttpOnly; Secure; SameSite=Strict";
  if (slug === "none") {
    c.header("Set-Cookie", `${cookie}; ${attrs}; Max-Age=0`);
    return c.redirect("/", 302);
  }
  if (!(await getSiteBySlug(c.env.DB, slug))) return c.json({ error: "not-found" }, 404);
  c.header("Set-Cookie", `${cookie}${encodeURIComponent(slug)}; ${attrs}; Max-Age=${YEAR}`);
  return c.redirect("/", 302);
});

async function sideSiteId(c: Parameters<Parameters<typeof createMiddleware<AppEnv>>[0]>[0]): Promise<number | null> {
  const slug = getCookie(c, SIDE_COOKIE);
  const site = slug ? await getSiteBySlug(c.env.DB, slug) : null;
  return site ? site.id : null;
}
