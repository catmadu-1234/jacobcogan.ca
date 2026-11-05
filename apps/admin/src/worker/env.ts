export interface Env {
  DB: D1Database;
  MEDIA: R2Bucket;
  ASSETS: Fetcher;
  ACCESS_TEAM_DOMAIN: string;
  ACCESS_AUD: string;
  /** Local dev only: sign in as this email on localhost without Cloudflare Access. */
  DEV_USER_EMAIL?: string;
  /** "1" while there is no login: whoever opens the admin picks a side (a site) and is remembered by a cookie. */
  OPEN_SIDES?: string;
}

export type AppEnv = {
  Bindings: Env;
  Variables: { email: string; siteId: number };
};
