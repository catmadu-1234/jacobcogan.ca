import { createMiddleware } from "hono/factory";
import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from "jose";
import { getUserSiteId } from "@senka/core";
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
    if (!email) return c.json({ error: "unauthenticated" }, 401);

    const siteId = await getUserSiteId(env.DB, email);
    if (siteId === null) return c.json({ error: "no-site" }, 403);

    c.set("email", email);
    c.set("siteId", siteId);
    await next();
  });
}
