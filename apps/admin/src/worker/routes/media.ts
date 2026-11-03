import { Hono } from "hono";
import {
  IdList, MAX_UPLOAD_BYTES, MediaCreate, MediaPatch, createMedia, deleteMedia, getMedia, getWork,
  markMediaReady, mediaKeys, parseRange, reorderMedia, updateMedia, type MediaVariant,
} from "@senka/core";
import type { AppEnv } from "../env";
import { notFound, parseId, readJson } from "../http";

const VARIANTS = new Set<string>(["original", "w480", "w1200", "w2400", "poster"]);
const IMMUTABLE = "public, max-age=31536000, immutable";

export const mediaRoutes = new Hono<AppEnv>();

mediaRoutes.post("/works/:id/media", async (c) => {
  const workId = parseId(c.req.param("id"));
  if (workId === null) return notFound(c);
  const body = await readJson(c, MediaCreate);
  if (!body.ok) return body.res;
  const media = await createMedia(c.env.DB, c.get("siteId"), workId, body.data);
  return media ? c.json(media, 201) : notFound(c);
});

mediaRoutes.put("/works/:id/media/order", async (c) => {
  const workId = parseId(c.req.param("id"));
  const siteId = c.get("siteId");
  if (workId === null || !(await getWork(c.env.DB, siteId, workId))) return notFound(c);
  const body = await readJson(c, IdList);
  if (!body.ok) return body.res;
  await reorderMedia(c.env.DB, siteId, workId, body.data);
  return c.body(null, 204);
});

/**
 * Streams one variant straight into R2. The stored content type comes from the media row, never from the
 * upload's headers, so nothing but the allowed image/video types can ever be served from the public site.
 */
mediaRoutes.put("/media/:id/blob/:variant", async (c) => {
  const id = parseId(c.req.param("id"));
  const media = id === null ? null : await getMedia(c.env.DB, c.get("siteId"), id);
  if (!media) return notFound(c);

  const variant = c.req.param("variant");
  if (!VARIANTS.has(variant) || !media.variants.includes(variant as MediaVariant)) {
    return c.json({ error: "invalid-variant" }, 400);
  }
  if (media.status === "ready") return c.json({ error: "already-ready" }, 409);

  const declared = c.req.header("content-length");
  if (declared === undefined) return c.json({ error: "length-required" }, 411);
  const length = Number(declared);
  if (!Number.isInteger(length) || length < 0) return c.json({ error: "invalid-length" }, 400);
  if (length > MAX_UPLOAD_BYTES) return c.json({ error: "too-large" }, 413);
  if (length === 0 || !c.req.raw.body) return c.json({ error: "empty" }, 400);

  await c.env.MEDIA.put(`${media.siteId}/${media.id}/${variant}`, c.req.raw.body, {
    httpMetadata: { contentType: variant === "original" ? media.mime : "image/webp", cacheControl: IMMUTABLE },
  });
  return c.body(null, 204);
});

mediaRoutes.patch("/media/:id", async (c) => {
  const id = parseId(c.req.param("id"));
  const siteId = c.get("siteId");
  const media = id === null ? null : await getMedia(c.env.DB, siteId, id);
  if (id === null || !media) return notFound(c);
  const body = await readJson(c, MediaPatch);
  if (!body.ok) return body.res;

  let bytes: number | null = null;
  if (body.data.status === "ready" && media.status !== "ready") {
    const keys = mediaKeys(media);
    const heads = await Promise.all(keys.map((k) => c.env.MEDIA.head(k)));
    const missing = media.variants.filter((_, i) => heads[i] === null);
    if (missing.length) return c.json({ error: "missing-variants", missing }, 409);
    bytes = heads.reduce((sum, h) => sum + h!.size, 0);
  }
  let result = media;
  if (body.data.alt !== undefined) result = (await updateMedia(c.env.DB, siteId, id, { alt: body.data.alt }))!;
  if (bytes !== null) result = (await markMediaReady(c.env.DB, siteId, id, bytes))!;
  return c.json(result);
});

mediaRoutes.delete("/media/:id", async (c) => {
  const id = parseId(c.req.param("id"));
  const keys = id === null ? null : await deleteMedia(c.env.DB, c.get("siteId"), id);
  if (!keys) return notFound(c);
  await c.env.MEDIA.delete(keys);
  return c.body(null, 204);
});

/**
 * Owner-only preview of any of the site's files, including hidden works and uploads still in progress
 * (the public site only serves visible, ready media). Supports byte ranges so videos can seek.
 */
mediaRoutes.get("/media/:id/file/:variant", async (c) => {
  const id = parseId(c.req.param("id"));
  const media = id === null ? null : await getMedia(c.env.DB, c.get("siteId"), id);
  const variant = c.req.param("variant");
  if (!media || !VARIANTS.has(variant) || !media.variants.includes(variant as MediaVariant)) return notFound(c);

  const key = `${media.siteId}/${media.id}/${variant}`;
  const head = await c.env.MEDIA.head(key);
  if (!head) return notFound(c);

  const range = parseRange(c.req.header("range") ?? null, head.size);
  if (range === "invalid") {
    return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${head.size}` } });
  }
  const object = await c.env.MEDIA.get(key, range ? { range } : undefined);
  if (!object) return notFound(c);

  const headers = new Headers({
    "Content-Type": head.httpMetadata?.contentType ?? "application/octet-stream",
    "Accept-Ranges": "bytes",
    "Cache-Control": "private, max-age=31536000, immutable",
    "X-Content-Type-Options": "nosniff",
    ETag: head.httpEtag,
  });
  if (range) {
    headers.set("Content-Range", `bytes ${range.offset}-${range.offset + range.length - 1}/${head.size}`);
    headers.set("Content-Length", String(range.length));
  } else {
    headers.set("Content-Length", String(head.size));
  }
  return new Response(object.body, { status: range ? 206 : 200, headers });
});
