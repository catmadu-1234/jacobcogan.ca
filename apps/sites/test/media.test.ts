import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { handleMediaRequest } from "../src/lib/mediaRoute";
import { makeWork, seedSites } from "./fixtures";

const get = (key: string, headers: Record<string, string> = {}) =>
  handleMediaRequest(env, new Request(`https://x.dev/media/${key}`, { headers }), key);

describe("public media route", () => {
  it("serves a visible, ready file with safe, cacheable headers", async () => {
    const { a } = await seedSites();
    const { media: [m] } = await makeWork(a, { title: "Shown" });
    const res = await get(`${a.id}/${m!.id}/original`);
    expect(res.status).toBe(200);
    expect(await res.text()).toBe(`${m!.id}:original:0123456789`);
    expect(res.headers.get("content-type")).toBe("image/jpeg");
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    expect(res.headers.get("accept-ranges")).toBe("bytes");
    expect(res.headers.get("cache-control")).toBe("public, max-age=31536000, immutable");
    expect(res.headers.get("access-control-allow-origin")).toBe("*");
    expect(res.headers.get("etag")).toBeTruthy();
  });

  it("serves derived variants as WebP", async () => {
    const { a } = await seedSites();
    const { media: [m] } = await makeWork(a, { title: "Shown" });
    expect((await get(`${a.id}/${m!.id}/w480`)).headers.get("content-type")).toBe("image/webp");
  });

  it("answers byte ranges with 206 so videos can seek", async () => {
    const { a } = await seedSites();
    const { media: [m] } = await makeWork(a, { title: "Clip", kind: "video" });
    const res = await get(`${a.id}/${m!.id}/original`, { range: "bytes=0-3" });
    expect(res.status).toBe(206);
    expect(res.headers.get("content-range")).toMatch(/^bytes 0-3\/\d+$/);
    expect((await res.text()).length).toBe(4);
  });

  it("answers an unsatisfiable range with 416", async () => {
    const { a } = await seedSites();
    const { media: [m] } = await makeWork(a, { title: "Clip", kind: "video" });
    const res = await get(`${a.id}/${m!.id}/original`, { range: "bytes=99999-" });
    expect(res.status).toBe(416);
    expect(res.headers.get("content-range")).toMatch(/^bytes \*\/\d+$/);
  });

  it("answers 304 when the browser already has the file", async () => {
    const { a } = await seedSites();
    const { media: [m] } = await makeWork(a, { title: "Shown" });
    const first = await get(`${a.id}/${m!.id}/original`);
    const res = await get(`${a.id}/${m!.id}/original`, { "if-none-match": first.headers.get("etag")! });
    expect(res.status).toBe(304);
    expect(await res.text()).toBe("");
  });

  it("never serves hidden, deleted or unfinished works, or another site's ids", async () => {
    const { a, b } = await seedSites();
    const hidden = await makeWork(a, { title: "Hidden", visible: false });
    const deleted = await makeWork(a, { title: "Deleted", deleted: true });
    const pending = await makeWork(a, { title: "Pending", pending: true });
    const shown = await makeWork(a, { title: "Shown" });
    for (const w of [hidden, deleted, pending]) {
      expect((await get(`${a.id}/${w.media[0]!.id}/original`)).status).toBe(404);
    }
    expect((await get(`${b.id}/${shown.media[0]!.id}/original`)).status).toBe(404);
  });

  it("404s for malformed keys, undeclared variants and missing files", async () => {
    const { a } = await seedSites();
    const { media: [m] } = await makeWork(a, { title: "Shown" });
    const id = `${a.id}/${m!.id}`;
    for (const key of ["../etc/passwd", `${id}/evil`, `${id}/w2400`, `${id}/original/extra`, `${id}`, `x/${m!.id}/original`, "", `${id}/original%2F..%2F..`]) {
      expect((await get(key)).status, key).toBe(404);
    }
    await env.MEDIA.delete(`${id}/original`);
    expect((await get(`${id}/original`)).status).toBe(404);
  });
});
