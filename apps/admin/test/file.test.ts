import { env } from "cloudflare:test";
import { describe, it, expect } from "vitest";
import { authed, bytesOf, call, newMedia, putBlob, request, seedTwoSites } from "./helpers";

const A = "a@test.dev";
const B = "b@test.dev";
const filePath = (id: number, variant: string) => `/api/media/${id}/file/${variant}`;

async function uploaded(variants = ["original", "w480"]) {
  const made = await newMedia(A, { variants });
  await putBlob(A, `/api/media/${made.media.id}/blob/original`, bytesOf("0123456789"));
  if (variants.includes("w480")) await putBlob(A, `/api/media/${made.media.id}/blob/w480`, bytesOf("small"));
  return made.media;
}

describe("admin media file route", () => {
  it("serves an uploaded file with safe headers", async () => {
    await seedTwoSites();
    const m = await uploaded();
    const res = await request(filePath(m.id, "original"), { headers: await authed(A) });
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("0123456789");
    expect(res.headers.get("content-type")).toBe("image/jpeg");
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    expect(res.headers.get("accept-ranges")).toBe("bytes");
    expect(res.headers.get("cache-control")).toBe("private, max-age=31536000, immutable");
  });

  it("serves the content type derived for derived variants", async () => {
    await seedTwoSites();
    const m = await uploaded();
    const res = await request(filePath(m.id, "w480"), { headers: await authed(A) });
    expect(res.headers.get("content-type")).toBe("image/webp");
  });

  it("answers byte ranges with 206 and Content-Range, so videos can seek", async () => {
    await seedTwoSites();
    const m = await uploaded();
    const res = await request(filePath(m.id, "original"), { headers: { ...(await authed(A)), range: "bytes=2-5" } });
    expect(res.status).toBe(206);
    expect(res.headers.get("content-range")).toBe("bytes 2-5/10");
    expect(await res.text()).toBe("2345");
  });

  it("answers an unsatisfiable range with 416", async () => {
    await seedTwoSites();
    const m = await uploaded();
    const res = await request(filePath(m.id, "original"), { headers: { ...(await authed(A)), range: "bytes=50-" } });
    expect(res.status).toBe(416);
    expect(res.headers.get("content-range")).toBe("bytes */10");
  });

  it("does not serve another site's files, undeclared variants or missing objects", async () => {
    await seedTwoSites();
    const m = await uploaded();
    expect((await request(filePath(m.id, "original"), { headers: await authed(B) })).status).toBe(404);
    expect((await request(filePath(m.id, "w2400"), { headers: await authed(A) })).status).toBe(404);
    expect((await request(filePath(m.id, "evil"), { headers: await authed(A) })).status).toBe(404);
    const pending = await newMedia(A);
    expect((await request(filePath(pending.media.id, "original"), { headers: await authed(A) })).status).toBe(404);
  });

  it("requires sign-in", async () => {
    await seedTwoSites();
    const m = await uploaded();
    expect((await request(filePath(m.id, "original"))).status).toBe(401);
  });

  it("also serves pending uploads to their owner, so previews work before publishing", async () => {
    await seedTwoSites();
    const m = await uploaded();
    const detail = (await (await call(A, "GET", `/api/works/${m.workId}`)).json()) as any;
    expect(detail.media[0].status).toBe("pending");
    expect((await request(filePath(m.id, "original"), { headers: await authed(A) })).status).toBe(200);
    expect((await env.MEDIA.list()).objects.length).toBe(2);
  });
});
