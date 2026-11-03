import { env } from "cloudflare:test";
import { describe, it, expect } from "vitest";
import { MAX_UPLOAD_BYTES } from "@senka/core";
import { bytesOf, call, newMedia, putBlob, request, authed, seedTwoSites } from "./helpers";

const A = "a@test.dev";
const B = "b@test.dev";
const blobPath = (id: number, variant: string) => `/api/media/${id}/blob/${variant}`;
const storedKeys = async () => (await env.MEDIA.list()).objects.map((o) => o.key).sort();

describe("media upload API", () => {
  it("uploads variants, marks the media ready and records the stored size", async () => {
    const { a } = await seedTwoSites();
    const { work, media, res } = await newMedia(A);
    expect(res.status).toBe(201);
    expect(media.status).toBe("pending");

    expect((await putBlob(A, blobPath(media.id, "original"), bytesOf("original-bytes"), { "content-type": "image/jpeg" })).status).toBe(204);
    expect((await putBlob(A, blobPath(media.id, "w480"), bytesOf("small"), { "content-type": "image/webp" })).status).toBe(204);

    const ready = await call(A, "PATCH", `/api/media/${media.id}`, { status: "ready", alt: "A sunrise" });
    expect(ready.status).toBe(200);
    expect(await ready.json()).toMatchObject({ status: "ready", alt: "A sunrise", bytes: "original-bytes".length + "small".length });

    const original = await env.MEDIA.get(`${a}/${media.id}/original`);
    expect(await original!.text()).toBe("original-bytes");
    expect(original!.httpMetadata!.contentType).toBe("image/jpeg");
    expect(original!.httpMetadata!.cacheControl).toBe("public, max-age=31536000, immutable");

    const detail = (await (await call(A, "GET", `/api/works/${work.id}`)).json()) as any;
    expect(detail.media.map((m: any) => [m.id, m.status])).toEqual([[media.id, "ready"]]);
    const me = (await (await call(A, "GET", "/api/me")).json()) as any;
    expect(me.storageBytes).toBe("original-bytes".length + "small".length);
  });

  it("refuses to mark media ready while a variant is missing", async () => {
    await seedTwoSites();
    const { media } = await newMedia(A);
    await putBlob(A, blobPath(media.id, "original"), bytesOf("x"));
    const res = await call(A, "PATCH", `/api/media/${media.id}`, { status: "ready" });
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: "missing-variants", missing: ["w480"] });
    const detail = (await (await call(A, "GET", `/api/works/${media.workId}`)).json()) as any;
    expect(detail.media[0].status).toBe("pending");
  });

  it("derives the stored content type on the server, ignoring the upload header", async () => {
    const { a } = await seedTwoSites();
    const { media } = await newMedia(A);
    await putBlob(A, blobPath(media.id, "original"), bytesOf("x"), { "content-type": "text/html" });
    await putBlob(A, blobPath(media.id, "w480"), bytesOf("y"), { "content-type": "text/html" });
    expect((await env.MEDIA.head(`${a}/${media.id}/original`))!.httpMetadata!.contentType).toBe("image/jpeg");
    expect((await env.MEDIA.head(`${a}/${media.id}/w480`))!.httpMetadata!.contentType).toBe("image/webp");
  });

  it("refuses to create media with a content type that must not be served", async () => {
    await seedTwoSites();
    for (const mime of ["text/html", "image/svg+xml", "application/javascript"]) {
      const { res } = await newMedia(A, { mime });
      expect(res.status, mime).toBe(400);
    }
  });

  it("rejects blobs over the upload cap before reading them", async () => {
    await seedTwoSites();
    const { media } = await newMedia(A);
    const res = await putBlob(A, blobPath(media.id, "original"), bytesOf("tiny"), { "content-length": String(MAX_UPLOAD_BYTES + 1) });
    expect(res.status).toBe(413);
    expect(await storedKeys()).toEqual([]);
  });

  it("rejects declared sizes over the cap when creating media", async () => {
    await seedTwoSites();
    const w = (await (await call(A, "POST", "/api/works")).json()) as any;
    const res = await call(A, "POST", `/api/works/${w.id}/media`, {
      kind: "image", mime: "image/jpeg", width: 1, height: 1, bytes: MAX_UPLOAD_BYTES + 1, variants: ["original"],
    });
    expect(res.status).toBe(400);
  });

  it("requires a Content-Length and a non-empty body", async () => {
    await seedTwoSites();
    const { media } = await newMedia(A);
    const stream = new ReadableStream({ start(c) { c.enqueue(bytesOf("abc")); c.close(); } });
    const noLength = await request(blobPath(media.id, "original"), {
      method: "PUT", headers: await authed(A), body: stream, duplex: "half",
    } as RequestInit);
    expect(noLength.status).toBe(411);
    const empty = await putBlob(A, blobPath(media.id, "original"), new Uint8Array(0), { "content-length": "0" });
    expect(empty.status).toBe(400);
    expect(await storedKeys()).toEqual([]);
  });

  it("rejects variants the media did not declare and unknown variant names", async () => {
    await seedTwoSites();
    const { media } = await newMedia(A);
    expect((await putBlob(A, blobPath(media.id, "w2400"), bytesOf("x"))).status).toBe(400);
    expect((await putBlob(A, blobPath(media.id, "evil"), bytesOf("x"))).status).toBe(400);
    expect((await putBlob(A, blobPath(media.id, "..%2F..%2Fx"), bytesOf("x"))).status).toBe(400);
    expect(await storedKeys()).toEqual([]);
  });

  it("will not overwrite the files of media that is already ready", async () => {
    await seedTwoSites();
    const { media } = await newMedia(A, { variants: ["original"] });
    await putBlob(A, blobPath(media.id, "original"), bytesOf("first"));
    await call(A, "PATCH", `/api/media/${media.id}`, { status: "ready" });
    const again = await putBlob(A, blobPath(media.id, "original"), bytesOf("second"));
    expect(again.status).toBe(409);
    expect(await (await env.MEDIA.get(`${media.siteId}/${media.id}/original`))!.text()).toBe("first");
  });

  it("is isolated per site for upload, patch, delete and reorder", async () => {
    await seedTwoSites();
    const { work, media } = await newMedia(A);
    expect((await putBlob(B, blobPath(media.id, "original"), bytesOf("x"))).status).toBe(404);
    expect((await call(B, "PATCH", `/api/media/${media.id}`, { alt: "x" })).status).toBe(404);
    expect((await call(B, "DELETE", `/api/media/${media.id}`)).status).toBe(404);
    expect((await call(B, "PUT", `/api/works/${work.id}/media/order`, [media.id])).status).toBe(404);
    const foreign = await call(B, "POST", `/api/works/${work.id}/media`, {
      kind: "image", mime: "image/jpeg", width: 1, height: 1, bytes: 1, variants: ["original"],
    });
    expect(foreign.status).toBe(404);
    expect(await storedKeys()).toEqual([]);
  });

  it("refuses to add media to a soft-deleted work", async () => {
    await seedTwoSites();
    const { work } = await newMedia(A);
    await call(A, "DELETE", `/api/works/${work.id}`);
    const res = await call(A, "POST", `/api/works/${work.id}/media`, {
      kind: "image", mime: "image/jpeg", width: 1, height: 1, bytes: 1, variants: ["original"],
    });
    expect(res.status).toBe(404);
  });

  it("deletes the row and every stored file", async () => {
    await seedTwoSites();
    const { work, media } = await newMedia(A);
    await putBlob(A, blobPath(media.id, "original"), bytesOf("x"));
    await putBlob(A, blobPath(media.id, "w480"), bytesOf("y"));
    expect(await storedKeys()).toHaveLength(2);
    expect((await call(A, "DELETE", `/api/media/${media.id}`)).status).toBe(204);
    expect(await storedKeys()).toEqual([]);
    const detail = (await (await call(A, "GET", `/api/works/${work.id}`)).json()) as any;
    expect(detail.media).toEqual([]);
  });

  it("reorders media within a work", async () => {
    await seedTwoSites();
    const { work, media: first } = await newMedia(A);
    const second = (await (await call(A, "POST", `/api/works/${work.id}/media`, {
      kind: "image", mime: "image/jpeg", width: 1, height: 1, bytes: 1, variants: ["original"],
    })).json()) as any;
    expect((await call(A, "PUT", `/api/works/${work.id}/media/order`, [second.id, first.id])).status).toBe(204);
    const detail = (await (await call(A, "GET", `/api/works/${work.id}`)).json()) as any;
    expect(detail.media.map((m: any) => m.id)).toEqual([second.id, first.id]);
  });
});
