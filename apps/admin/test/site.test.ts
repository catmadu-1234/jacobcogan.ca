import { describe, it, expect } from "vitest";
import { call, seedTwoSites } from "./helpers";

const A = "a@test.dev";

describe("site API", () => {
  it("updates name, about, links and theme, merging the theme", async () => {
    await seedTwoSites();
    const res = await call(A, "PATCH", "/api/site", {
      name: "Jacob Cogan",
      about: "Painter.",
      links: [{ label: "Instagram", url: "https://instagram.com/x" }],
      theme: { accent: "#7A3E2E" },
    });
    expect(res.status).toBe(200);
    const site = (await res.json()) as any;
    expect(site).toMatchObject({ name: "Jacob Cogan", about: "Painter." });
    expect(site.theme).toMatchObject({ accent: "#7A3E2E", preset: "grotesk" });
    const me = (await (await call(A, "GET", "/api/me")).json()) as any;
    expect(me.site.links).toHaveLength(1);
  });

  it("rejects a bad accent colour", async () => {
    await seedTwoSites();
    expect((await call(A, "PATCH", "/api/site", { theme: { accent: "red" } })).status).toBe(400);
  });

  it("rejects non-http links, which would end up on the public site", async () => {
    await seedTwoSites();
    for (const url of ["javascript:alert(1)", "data:text/html,x", "ftp://x.com", "not a url"]) {
      const res = await call(A, "PATCH", "/api/site", { links: [{ label: "x", url }] });
      expect(res.status, url).toBe(400);
    }
  });

  it("rejects an out-of-range row height", async () => {
    await seedTwoSites();
    expect((await call(A, "PATCH", "/api/site", { theme: { rowHeight: 50 } })).status).toBe(400);
  });
});
