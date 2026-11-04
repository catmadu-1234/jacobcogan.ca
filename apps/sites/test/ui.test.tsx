import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { PublicMedia, PublicWork } from "@senka/core";
import { AboutPage } from "../src/ui/AboutPage";
import { IndexPage } from "../src/ui/IndexPage";
import { MediaView } from "../src/ui/MediaView";
import { RootPage } from "../src/ui/RootPage";
import { Rows } from "../src/ui/Rows";
import { SiteHeader } from "../src/ui/SiteHeader";
import { WorkPage } from "../src/ui/WorkPage";

const image = (over: Partial<PublicMedia> = {}): PublicMedia => ({
  kind: "image", width: 3000, height: 2000, color: "#aabbcc", alt: "", duration: null,
  src: "/media/1/7/w1200", srcset: "/media/1/7/w480 480w, /media/1/7/w1200 1200w", poster: null, full: "/media/1/7/original", ...over,
});
const video = (over: Partial<PublicMedia> = {}): PublicMedia =>
  image({ kind: "video", duration: 12, src: "/media/1/8/original", srcset: null, poster: "/media/1/8/poster", full: "/media/1/8/original", ...over });
const work = (slug: string, over: Partial<PublicWork> = {}): PublicWork => ({
  slug, title: slug.replace("-", " "), details: [], tags: [], media: [image()], cover: image(), updatedAt: "", ...over,
});
// React writes a few attribute names in camelCase (srcSet, fetchPriority, playsInline). HTML attribute names are
// case-insensitive, so the assertions compare them in lower case.
const html = (node: React.ReactElement) =>
  renderToStaticMarkup(node).replace(/\b(srcSet|fetchPriority|playsInline|imageSrcSet|imageSizes|crossOrigin)=/g, (m) => m.toLowerCase());

describe("SiteHeader", () => {
  it("links home to the site's own root or to its path on the shared address", () => {
    expect(html(<SiteHeader siteName="Jacob" basePath="" current="work" />)).toContain('href="/"');
    const shared = html(<SiteHeader siteName="Jacob" basePath="/site-a" current="about" />);
    expect(shared).toContain('href="/site-a"');
    expect(shared).toContain('href="/site-a/about"');
    expect(shared).toMatch(/href="\/site-a\/about"[^>]*aria-current="page"|aria-current="page"[^>]*href="\/site-a\/about"/);
  });
});

describe("Rows", () => {
  it("links each work to its page with its true proportions and a loading colour", () => {
    const out = html(<Rows works={[work("blue-hour")]} basePath="/site-a" rowHeight={320} showCaptions={false} />);
    expect(out).toContain('href="/site-a/work/blue-hour"');
    expect(out).toContain("--ar:1.5000");
    expect(out).toContain("--bg:#aabbcc");
    expect(out).toContain('width="3000"');
    expect(out).toContain('height="2000"');
    expect(out).toContain('srcset="/media/1/7/w480 480w, /media/1/7/w1200 1200w"');
    expect(out).toContain("--vt:work-blue-hour");
  });

  it("loads the first six images eagerly (first at high priority) and the rest lazily", () => {
    const many = Array.from({ length: 8 }, (_, i) => work(`w-${i}`));
    const imgs = html(<Rows works={many} basePath="" rowHeight={320} showCaptions={false} />).match(/<img[^>]*>/g)!;
    expect(imgs).toHaveLength(8);
    expect(imgs[0]).toContain('fetchpriority="high"');
    expect(imgs[0]).not.toContain('loading="lazy"');
    expect(imgs[5]).not.toContain('loading="lazy"');
    expect(imgs[6]).toContain('loading="lazy"');
    expect(imgs[7]).toContain('loading="lazy"');
    expect(imgs[1]).not.toContain("fetchpriority");
  });

  it("uses a video's poster frame as its thumbnail, and shows no image when there is none", () => {
    const withPoster = html(<Rows works={[work("clip", { cover: video(), media: [video()] })]} basePath="" rowHeight={320} showCaptions={false} />);
    expect(withPoster).toContain('src="/media/1/8/poster"');
    const noPoster = html(<Rows works={[work("clip", { cover: video({ poster: null }) })]} basePath="" rowHeight={320} showCaptions={false} />);
    expect(noPoster).not.toContain("<img");
  });

  it("names each image for screen readers from its description or the work's title", () => {
    const out = html(<Rows works={[work("blue-hour", { title: "Blue Hour", cover: image({ alt: "A harbour" }) }), work("study", { title: "Study" })]} basePath="" rowHeight={320} showCaptions={false} />);
    expect(out).toContain('alt="A harbour"');
    expect(out).toContain('alt="Study"');
  });

  it("only shows titles under the images when the site asks for captions", () => {
    const off = html(<Rows works={[work("blue-hour", { title: "Blue Hour" })]} basePath="" rowHeight={320} showCaptions={false} />);
    const on = html(<Rows works={[work("blue-hour", { title: "Blue Hour" })]} basePath="" rowHeight={320} showCaptions />);
    expect(off).toContain('aria-hidden="true"');
    expect(on).not.toContain('aria-hidden="true"');
    expect(on).toContain("Blue Hour");
  });
});

describe("MediaView", () => {
  it("shows an image as a link to the original, so it opens full size", () => {
    const out = html(<MediaView media={image()} alt="Harbour" priority name="blue-hour" />);
    expect(out).toContain('href="/media/1/7/original"');
    expect(out).toContain('data-full="/media/1/7/original"');
    expect(out).toContain('alt="Harbour"');
    expect(out).toContain('src="/media/1/7/w1200"');
    expect(out).toContain("--vt:work-blue-hour");
  });

  it("plays short clips muted on a loop, keeping controls as the no-script fallback", () => {
    const out = html(<MediaView media={video({ duration: 12 })} alt="" priority={false} />);
    expect(out).toContain("<video");
    expect(out).toContain("data-autoplay");
    for (const attr of ["muted", "loop", "playsinline", "controls", 'poster="/media/1/8/poster"', 'preload="metadata"']) expect(out, attr).toContain(attr);
  });

  it("gives long clips controls and no autoplay", () => {
    const out = html(<MediaView media={video({ duration: 95 })} alt="" priority={false} />);
    expect(out).toContain("controls");
    expect(out).not.toContain("data-autoplay");
    expect(out).not.toContain("loop");
  });
});

describe("WorkPage", () => {
  const base = { siteName: "Jacob", basePath: "/site-a", prev: null, next: null };

  it("shows the title, details, linked tags and previous/next works", () => {
    const w = work("blue-hour", {
      title: "Blue Hour",
      details: [{ key: "medium", label: "Medium", value: "Oil", type: "text" }],
      tags: [{ name: "Oil", slug: "oil" }],
    });
    const out = html(<WorkPage {...base} work={w} prev={{ slug: "newer", title: "Newer" }} next={{ slug: "older", title: "Older" }} />);
    expect(out).toContain("<h1");
    expect(out).toContain("Blue Hour");
    expect(out).toContain("Medium");
    expect(out).toContain("Oil");
    expect(out).toContain('href="/site-a/tag/oil"');
    expect(out).toMatch(/<a[^>]*rel="prev"[^>]*href="\/site-a\/work\/newer"|<a[^>]*href="\/site-a\/work\/newer"[^>]*rel="prev"/);
    expect(out).toMatch(/<a[^>]*rel="next"[^>]*href="\/site-a\/work\/older"|<a[^>]*href="\/site-a\/work\/older"[^>]*rel="next"/);
  });

  it("makes link-type details clickable only for http(s) addresses", () => {
    const detail = (value: string) => ({ key: "shop", label: "Shop", value, type: "url" as const });
    const safe = html(<WorkPage {...base} work={work("a", { details: [detail("https://shop.example.com/x")] })} />);
    expect(safe).toContain('href="https://shop.example.com/x"');
    expect(safe).toContain('rel="noopener noreferrer"');
    for (const bad of ["javascript:alert(1)", "data:text/html,x", "  javascript:alert(1)", "ftp://x.com", "shop.example.com"]) {
      const out = html(<WorkPage {...base} work={work("a", { details: [detail(bad)] })} />);
      expect(out, bad).not.toContain(`href="${bad}"`);
      expect(out, bad).not.toMatch(/href="\s*javascript:/i);
      expect(out, bad).toContain("Shop");
    }
  });

  it("escapes text instead of treating it as HTML", () => {
    const out = html(<WorkPage {...base} work={work("a", { title: "<script>alert(1)</script>", details: [{ key: "m", label: "M", value: "<img src=x onerror=alert(1)>", type: "text" }] })} />);
    expect(out).not.toContain("<script>alert(1)");
    expect(out).not.toContain("<img src=x");
    expect(out).toContain("&lt;script&gt;");
  });

  it("includes the full-size viewer only when there is an image to open", () => {
    expect(html(<WorkPage {...base} work={work("a")} />)).toContain("<dialog");
    expect(html(<WorkPage {...base} work={work("a", { media: [video()] })} />)).not.toContain("<dialog");
  });
});

describe("AboutPage", () => {
  it("turns blank-line separated text into paragraphs and never renders HTML", () => {
    const out = html(<AboutPage siteName="Jacob" basePath="" about={"First paragraph.\n\nSecond <b>one</b>."} links={[]} />);
    expect(out.match(/<p/g)!.length).toBeGreaterThanOrEqual(2);
    expect(out).toContain("First paragraph.");
    expect(out).toContain("&lt;b&gt;one&lt;/b&gt;");
    expect(out).not.toContain("<b>one");
  });

  it("lists only http(s) links, opening in a new tab safely", () => {
    const out = html(<AboutPage siteName="J" basePath="" about="x" links={[{ label: "Instagram", url: "https://instagram.com/x" }, { label: "Bad", url: "javascript:alert(1)" }]} />);
    expect(out).toContain('href="https://instagram.com/x"');
    expect(out).toContain('rel="noopener noreferrer"');
    expect(out).not.toContain("javascript:");
    expect(out).not.toContain("Bad");
  });

  it("says so when there is nothing to show yet", () => {
    expect(html(<AboutPage siteName="J" basePath="" about="" links={[]} />)).toContain("Nothing here yet.");
  });
});

describe("IndexPage", () => {
  const props = { siteName: "Jacob", basePath: "/site-a", rowHeight: 320, showCaptions: false };

  it("shows a text filter row only when there are at least two tags, marking the active one", () => {
    const tags = [{ name: "Drawing", slug: "drawing", count: 1 }, { name: "Painting", slug: "painting", count: 2 }];
    const out = html(<IndexPage {...props} works={[work("a")]} tags={tags} activeTag="painting" />);
    expect(out).toContain('href="/site-a/tag/drawing"');
    expect(out).toMatch(/href="\/site-a\/tag\/painting"[^>]*aria-current="page"|aria-current="page"[^>]*href="\/site-a\/tag\/painting"/);
    expect(out).toContain(">All<");
    expect(html(<IndexPage {...props} works={[work("a")]} tags={tags.slice(0, 1)} activeTag={null} />)).not.toContain(">All<");
  });

  it("explains an empty gallery", () => {
    expect(html(<IndexPage {...props} works={[]} tags={[]} activeTag={null} />)).toContain("Nothing here yet.");
  });
});

describe("RootPage", () => {
  it("links to every site", () => {
    const out = html(<RootPage sites={[{ name: "Site A", slug: "site-a" }, { name: "Site B", slug: "site-b" }]} />);
    expect(out).toContain('href="/site-a"');
    expect(out).toContain("Site B");
  });
});
