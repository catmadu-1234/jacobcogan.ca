import { getPublicMediaFile, parseRange, type MediaVariant } from "@senka/core";

const KEY = /^(\d{1,12})\/(\d{1,12})\/(original|w480|w1200|w2400|poster)$/;

export interface MediaEnv {
  DB: D1Database;
  MEDIA: R2Bucket;
}

const notFound = () => new Response("Not found", { status: 404, headers: { "Cache-Control": "no-store" } });

/** True when the browser's If-None-Match already names this version of the file. */
function etagMatches(header: string | null, etag: string): boolean {
  if (!header) return false;
  if (header.trim() === "*") return true;
  return header.split(",").some((candidate) => candidate.trim().replace(/^W\//, "") === etag);
}

/**
 * Serves one stored file, but only if the work it belongs to is visible and the upload finished. Files are
 * addressed by immutable keys, so browsers may cache them for a year. Supports byte ranges for video seeking.
 */
export async function handleMediaRequest(env: MediaEnv, request: Request, key: string): Promise<Response> {
  const match = KEY.exec(key);
  if (!match) return notFound();
  const [, siteId, mediaId, variant] = match as unknown as [string, string, string, MediaVariant];

  const media = await getPublicMediaFile(env.DB, Number(siteId), Number(mediaId));
  if (!media || !media.variants.includes(variant)) return notFound();

  const head = await env.MEDIA.head(`${siteId}/${mediaId}/${variant}`);
  if (!head) return notFound();

  const headers = new Headers({
    "Content-Type": head.httpMetadata?.contentType ?? "application/octet-stream",
    "Accept-Ranges": "bytes",
    "Cache-Control": "public, max-age=31536000, immutable",
    "X-Content-Type-Options": "nosniff",
    "Access-Control-Allow-Origin": "*",
    ETag: head.httpEtag,
  });

  if (etagMatches(request.headers.get("if-none-match"), head.httpEtag)) return new Response(null, { status: 304, headers });

  const range = parseRange(request.headers.get("range"), head.size);
  if (range === "invalid") {
    headers.set("Content-Range", `bytes */${head.size}`);
    return new Response(null, { status: 416, headers });
  }
  const object = await env.MEDIA.get(`${siteId}/${mediaId}/${variant}`, range ? { range } : undefined);
  if (!object) return notFound();

  if (range) {
    headers.set("Content-Range", `bytes ${range.offset}-${range.offset + range.length - 1}/${head.size}`);
    headers.set("Content-Length", String(range.length));
  } else {
    headers.set("Content-Length", String(head.size));
  }
  return new Response(object.body, { status: range ? 206 : 200, headers });
}
