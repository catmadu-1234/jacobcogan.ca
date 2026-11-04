import { describe, expect, it } from "vitest";
import { authed, call, request, seedTwoSites } from "./helpers";

const A = "a@test.dev";

describe("cross-site writes", () => {
  it("refuses a state-changing request the browser says came from another site", async () => {
    await seedTwoSites();
    const res = await request("/api/works", { method: "POST", headers: { ...(await authed(A)), "sec-fetch-site": "cross-site" } });
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "cross-site" });
    expect(((await (await call(A, "GET", "/api/works")).json()) as any[])).toEqual([]);
  });

  it("allows same-origin and same-site requests and requests with no Fetch Metadata (other tools)", async () => {
    await seedTwoSites();
    for (const site of ["same-origin", "same-site", "none", undefined]) {
      const headers: Record<string, string> = { ...(await authed(A)) };
      if (site) headers["sec-fetch-site"] = site;
      const res = await request("/api/works", { method: "POST", headers });
      expect(res.status, String(site)).toBe(201);
    }
  });

  it("still lets a link from another site open the admin (reads are not restricted)", async () => {
    await seedTwoSites();
    const res = await request("/api/me", { headers: { ...(await authed(A)), "sec-fetch-site": "cross-site" } });
    expect(res.status).toBe(200);
  });
});

describe("JSON bodies", () => {
  async function patchSite(contentType: string | null) {
    const headers: Record<string, string> = { ...(await authed(A)) };
    if (contentType) headers["content-type"] = contentType;
    return request("/api/site", { method: "PATCH", headers, body: JSON.stringify({ about: "hi" }) });
  }

  it("refuses a JSON body sent as a form-style content type (the kind a web page can send without permission)", async () => {
    await seedTwoSites();
    for (const type of ["text/plain", "application/x-www-form-urlencoded", "multipart/form-data; boundary=x", null]) {
      const res = await patchSite(type);
      expect(res.status, String(type)).toBe(415);
      expect(await res.json()).toEqual({ error: "unsupported-media-type" });
    }
  });

  it("accepts application/json, with or without a charset", async () => {
    await seedTwoSites();
    expect((await patchSite("application/json")).status).toBe(200);
    expect((await patchSite("application/json; charset=utf-8")).status).toBe(200);
  });
});
