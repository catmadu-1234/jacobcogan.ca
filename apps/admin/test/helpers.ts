import { env } from "cloudflare:test";
import { SignJWT, createLocalJWKSet, exportJWK, generateKeyPair } from "jose";
import { createApp } from "../src/worker";

const TEAM = "test.cloudflareaccess.com";
const AUD = "test-aud";

const pair = await generateKeyPair("RS256", { extractable: true });
const jwk = { ...(await exportJWK(pair.publicKey)), kid: "test-key", alg: "RS256", use: "sig" };

export const app = createApp({ getKey: createLocalJWKSet({ keys: [jwk] }) });

export async function signToken(
  email: string,
  opts: { aud?: string; key?: CryptoKey; expiresIn?: string | number } = {},
): Promise<string> {
  return new SignJWT({ email })
    .setProtectedHeader({ alg: "RS256", kid: "test-key" })
    .setIssuer(`https://${TEAM}`)
    .setAudience(opts.aud ?? AUD)
    .setIssuedAt()
    .setExpirationTime(opts.expiresIn ?? "1h")
    .sign(opts.key ?? pair.privateKey);
}

/** Headers Cloudflare Access would add for a signed-in user. */
export async function authed(email: string): Promise<Record<string, string>> {
  return { "Cf-Access-Jwt-Assertion": await signToken(email) };
}

export function request(path: string, init: RequestInit = {}, bindings: Partial<typeof env> = {}) {
  return app.request(`https://admin.example.com${path}`, init, { ...env, ...bindings });
}

export async function seedTwoSites(): Promise<{ a: number; b: number }> {
  const insertSite = env.DB.prepare("INSERT INTO sites (slug, name) VALUES (?, ?)");
  const [ra, rb] = await env.DB.batch([insertSite.bind("site-a", "Site A"), insertSite.bind("site-b", "Site B")]);
  const a = ra!.meta.last_row_id as number;
  const b = rb!.meta.last_row_id as number;
  const insertUser = env.DB.prepare("INSERT INTO users (email, site_id) VALUES (?, ?)");
  await env.DB.batch([insertUser.bind("a@test.dev", a), insertUser.bind("b@test.dev", b)]);
  return { a, b };
}

/** Authenticated JSON call to the admin API as `email`. */
export async function call(email: string, method: string, path: string, body?: unknown, rawBody?: string): Promise<Response> {
  const headers: Record<string, string> = { ...(await authed(email)) };
  if (body !== undefined || rawBody !== undefined) headers["content-type"] = "application/json";
  return request(path, { method, headers, body: rawBody ?? (body === undefined ? undefined : JSON.stringify(body)) });
}

export async function contentVersion(email: string): Promise<number> {
  return ((await (await call(email, "GET", "/api/me")).json()) as any).site.contentVersion;
}

export const bytesOf = (text: string) => new TextEncoder().encode(text);

/** Raw upload to the blob endpoint; Content-Length is sent explicitly, as a real browser does. */
export async function putBlob(
  email: string,
  path: string,
  body: Uint8Array | null,
  headers: Record<string, string> = {},
): Promise<Response> {
  const lengthHeader: Record<string, string> = body ? { "content-length": String(body.byteLength) } : {};
  return request(path, {
    method: "PUT",
    headers: { ...(await authed(email)), ...lengthHeader, ...headers },
    body: (body ?? undefined) as unknown as BodyInit | undefined,
  });
}

/** Creates a work and a pending media row through the API. */
export async function newMedia(
  email: string,
  opts: { variants?: string[]; kind?: "image" | "video"; mime?: string } = {},
): Promise<{ work: any; media: any; res: Response }> {
  const work = (await (await call(email, "POST", "/api/works")).json()) as any;
  const kind = opts.kind ?? "image";
  const res = await call(email, "POST", `/api/works/${work.id}/media`, {
    kind,
    mime: opts.mime ?? (kind === "image" ? "image/jpeg" : "video/mp4"),
    width: 100,
    height: 50,
    bytes: 10,
    variants: opts.variants ?? ["original", "w480"],
  });
  return { work, media: res.status === 201 ? await res.json() : null, res };
}
