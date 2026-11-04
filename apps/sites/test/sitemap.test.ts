import { describe, expect, it } from "vitest";
import { buildSitemap } from "../src/lib/sitemap";

describe("buildSitemap", () => {
  it("lists the home page, about page, works and tag pages as absolute URLs", () => {
    const xml = buildSitemap("https://art.example.com", "", ["blue-hour", "study"], ["oil"]);
    for (const path of ["/", "/about", "/work/blue-hour", "/work/study", "/tag/oil"]) {
      expect(xml).toContain(`<loc>https://art.example.com${path}</loc>`);
    }
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
    expect(xml).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">');
  });
  it("prefixes every URL with the site's path on the shared address", () => {
    const xml = buildSitemap("https://senka.workers.dev", "/site-a", ["x"], []);
    expect(xml).toContain("<loc>https://senka.workers.dev/site-a</loc>");
    expect(xml).toContain("<loc>https://senka.workers.dev/site-a/about</loc>");
    expect(xml).toContain("<loc>https://senka.workers.dev/site-a/work/x</loc>");
  });
  it("escapes characters that are special in XML", () => {
    const xml = buildSitemap("https://x.dev", "", ["a&b<c"], []);
    expect(xml).toContain("a&amp;b&lt;c");
    expect(xml).not.toContain("a&b<c");
  });
});
