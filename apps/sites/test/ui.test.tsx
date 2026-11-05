import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { PublicMedia, PublicPost, PublicWork } from "@senka/core";
import { buildSections } from "../src/lib/filters";
import { AboutPage } from "../src/ui/AboutPage";
import { FilterRail } from "../src/ui/FilterRail";
import { Hero } from "../src/ui/Hero";
import { IndexList } from "../src/ui/IndexList";
import { IndexPage } from "../src/ui/IndexPage";
import { MediaView } from "../src/ui/MediaView";
import { RootPage } from "../src/ui/RootPage";
import { Rows } from "../src/ui/Rows";
import { SiteFooter } from "../src/ui/SiteFooter";
import { SiteHeader } from "../src/ui/SiteHeader";
import { StudioPage } from "../src/ui/StudioPage";
import { StudioPost } from "../src/ui/StudioPost";
import { ViewToggle } from "../src/ui/ViewToggle";
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
  renderToStaticMarkup(node).replace(/\b(srcSet|fetchPriority|playsInline|dateTime|imageSrcSet|imageSizes|crossOrigin)=/g, (m) => m.toLowerCase());

describe("SiteHeader", () => {
  it("links home to the site's own root or to its path on the shared address", () => {
    expect(html(<SiteHeader siteName="Jacob" basePath="" current="work" />)).toContain('href="/"');
    const shared = html(<SiteHeader siteName="Jacob" basePath="/site-a" current="about" />);
    expect(shared).toContain('href="/site-a"');
    expect(shared).toContain('href="/site-a/about"');
    expect(shared).toMatch(/href="\/site-a\/about"[^>]*aria-current="page"|aria-current="page"[^>]*href="\/site-a\/about"/);
  });
});

describe("Hero", () => {
  it("leads with the artist's name as the page heading, with a line about them and the size of the body of work", () => {
    const out = html(<Hero name="Elio Marsh" tagline="Painter and printmaker." count={9} years="2022–2025" />);
    expect(out).toMatch(/<h1[^>]*>Elio Marsh<\/h1>/);
    expect(out).toContain("Painter and printmaker.");
    expect(out).toContain("9 works");
    expect(out).toContain("2022–2025");
  });
  it("says '1 work' for one, and leaves out what it doesn't have", () => {
    const out = html(<Hero name="Mira" tagline="" count={1} years="" />);
    expect(out).toContain("1 work");
    expect(out).not.toContain("1 works");
    expect(out).not.toContain("<p class=\"_tagline");
  });
  it("says how many of the works are showing while a filter is on", () => {
    const out = html(<Hero name="Mira" tagline="" count={3} total={9} years="" />);
    expect(out).toContain("3 of 9 works");
    expect(html(<Hero name="Mira" tagline="" count={9} total={9} years="" />)).toContain("9 works");
    expect(html(<Hero name="Mira" tagline="" count={9} total={9} years="" />)).not.toContain("of 9");
  });
  it("marks the count so the in-place filter can update it", () => {
    expect(html(<Hero name="Mira" tagline="" count={3} total={9} years="" />)).toContain("data-result-count");
  });
  it("escapes the name", () => {
    expect(html(<Hero name={"<b>x</b>"} tagline="" count={0} years="" />)).not.toContain("<b>x</b>");
  });
});

describe("ViewToggle", () => {
  it("offers the grid and the index, marking the current one and keeping the active filters", () => {
    const out = html(<ViewToggle basePath="/site-a" filters={{ medium: "oil" }} view="index" />);
    expect(out).toContain('href="/site-a?medium=oil"');
    expect(out).toContain('href="/site-a?medium=oil&amp;view=index"');
    expect(out).toMatch(/href="\/site-a\?medium=oil&amp;view=index"[^>]*aria-current="page"|aria-current="page"[^>]*href="\/site-a\?medium=oil&amp;view=index"/);
    expect(out).not.toMatch(/href="\/site-a\?medium=oil"[^>]*aria-current/);
  });
  it("marks its links so the in-place filter can keep them in step", () => {
    expect(html(<ViewToggle basePath="" filters={{}} view="grid" />)).toContain('data-view="index"');
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

  it("numbers each work, and only reads the title aloud once", () => {
    const out = html(<Rows works={[work("a", { title: "Alpha" }), work("b", { title: "Beta" })]} basePath="" rowHeight={320} showCaptions={false} />);
    expect(out).toContain(">01<");
    expect(out).toContain(">02<");
    expect(out).toContain('aria-hidden="true"');
  });

  it("carries what the in-place filter needs on every tile, and hides tiles the filters rule out", () => {
    const a = work("a", { tags: [{ name: "Oil", slug: "oil" }], details: [{ key: "medium", label: "Medium", value: "Oil on linen", type: "text" }, { key: "year", label: "Year", value: "2024", type: "text" }] });
    const b = work("b", { details: [{ key: "medium", label: "Medium", value: "Ink", type: "text" }] });
    const all = html(<Rows works={[a, b]} basePath="" rowHeight={320} showCaptions={false} />);
    expect(all).toContain('data-medium="oil-on-linen"');
    expect(all).toContain('data-year="2024"');
    expect(all).toContain('data-tags="oil"');
    expect(all.match(/data-work=/g)).toHaveLength(2);
    expect(all).not.toMatch(/<li[^>]*\shidden/);
    const filtered = html(<Rows works={[a, b]} basePath="" rowHeight={320} showCaptions={false} filters={{ medium: "ink" }} />);
    expect(filtered.match(/<li[^>]*hidden/g)).toHaveLength(1);
    expect(filtered).toMatch(/<li[^>]*data-medium="oil-on-linen"[^>]*hidden|<li[^>]*hidden[^>]*data-medium="oil-on-linen"/);
  });

  it("always shows titles under the images when the site asks for captions", () => {
    const off = html(<Rows works={[work("blue-hour", { title: "Blue Hour" })]} basePath="" rowHeight={320} showCaptions={false} />);
    const on = html(<Rows works={[work("blue-hour", { title: "Blue Hour" })]} basePath="" rowHeight={320} showCaptions />);
    expect(off).toContain('data-captions="hover"');
    expect(on).toContain('data-captions="always"');
  });
});

describe("IndexList", () => {
  const works = [
    work("blue-hour", { title: "Blue Hour", tags: [{ name: "Painting", slug: "painting" }, { name: "Oil", slug: "oil" }], details: [{ key: "year", label: "Year", value: "2025", type: "text" }] }),
    work("quiet-room", { title: "Quiet Room", cover: video() }),
  ];
  it("lists each work as a numbered row linking to its page, with its tags and year", () => {
    const out = html(<IndexList works={works} basePath="/site-a" />);
    expect(out).toContain('href="/site-a/work/blue-hour"');
    expect(out).toContain('href="/site-a/work/quiet-room"');
    expect(out).toContain(">01<");
    expect(out).toContain("Blue Hour");
    expect(out).toContain("Painting");
    expect(out).toContain("Oil");
    expect(out).toContain("2025");
  });
  it("carries a preview picture for each row, using a video's poster", () => {
    const out = html(<IndexList works={works} basePath="" />);
    expect(out).toContain('src="/media/1/7/w1200"');
    expect(out).toContain('src="/media/1/8/poster"');
  });
  it("escapes titles", () => {
    expect(html(<IndexList works={[work("x", { title: "<script>alert(1)</script>" })]} basePath="" />)).not.toContain("<script>alert(1)");
  });
  it("carries the same filter data as the grid and hides rows the filters rule out", () => {
    const a = work("a", { details: [{ key: "project", label: "Project", value: "Studies", type: "text" }] });
    const b = work("b");
    const out = html(<IndexList works={[a, b]} basePath="" filters={{ project: "studies" }} />);
    expect(out.match(/data-work=/g)).toHaveLength(2);
    expect(out).toContain('data-project="studies"');
    expect(out.match(/<li[^>]*hidden/g)).toHaveLength(1);
  });
});

describe("SiteFooter", () => {
  it("shows the name, the year, a way back to the top and only safe links", () => {
    const out = html(<SiteFooter siteName="Elio Marsh" basePath="/site-a" links={[{ label: "Instagram", url: "https://instagram.com/x" }, { label: "Bad", url: "javascript:alert(1)" }]} />);
    expect(out).toContain("Elio Marsh");
    expect(out).toMatch(/© \d{4}/);
    expect(out).toContain('href="https://instagram.com/x"');
    expect(out).toContain('rel="noopener noreferrer"');
    expect(out).not.toContain("javascript:");
    expect(out).not.toContain("Bad");
    expect(out).toMatch(/href="#"/);
  });
});

describe("FilterRail", () => {
  const w = (slug: string, medium: string, year: string, project?: string) =>
    work(slug, { details: [{ key: "medium", label: "Medium", value: medium, type: "text" }, ...(project ? [{ key: "project", label: "Project", value: project, type: "text" as const }] : []), { key: "year", label: "Year", value: year, type: "text" }] });
  const works = [w("a", "Oil on linen", "2025", "Harbour"), w("b", "Oil on linen", "2024"), w("c", "Ink on paper", "2024", "Harbour")];
  const rail = (filters = {}, extra: object = {}) =>
    html(<FilterRail sections={buildSections(works, filters)} filters={filters} basePath="/site-a" view="grid" {...extra} />);

  it("groups the choices under Medium, Project and Year, each with how many works it holds", () => {
    const out = rail();
    for (const title of ["Medium", "Project", "Year"]) expect(out).toContain(`>${title}<`);
    expect(out).toContain("Oil on linen");
    expect(out).toContain("Harbour");
    expect(out).toContain("2025");
    expect(out).toMatch(/data-count[^>]*>2</);
  });

  it("links each choice to the gallery with that filter applied, and a chosen one back to without it", () => {
    const off = rail();
    expect(off).toContain('href="/site-a?medium=oil-on-linen"');
    const on = rail({ medium: "oil-on-linen", year: "2024" });
    expect(on).toMatch(/href="\/site-a\?year=2024"[^>]*aria-current="true"|aria-current="true"[^>]*href="\/site-a\?year=2024"/);
    expect(on).toContain('href="/site-a?medium=oil-on-linen&amp;year=2025"');
  });

  it("gives every choice the data the in-place filter reads", () => {
    const out = rail();
    expect(out).toContain('data-facet="medium"');
    expect(out).toContain('data-value="oil-on-linen"');
  });

  it("dims choices that would leave nothing", () => {
    const out = rail({ year: "2025" });
    expect(out).toMatch(/data-value="ink-on-paper"[^>]*data-empty|data-empty[^>]*data-value="ink-on-paper"/);
  });

  it("always carries a clear button, hidden until a filter is on", () => {
    expect(rail()).toMatch(/data-clear[^>]*hidden/);
    const on = rail({ medium: "ink-on-paper" });
    expect(on).toMatch(/data-clear[^>]*href="\/site-a"|href="\/site-a"[^>]*data-clear/);
    expect(on).not.toMatch(/data-clear[^>]*hidden/);
  });

  it("shows an active tag filter by name, with a way to remove it", () => {
    const out = rail({ tag: "oil" }, { activeTagName: "Oil" });
    expect(out).toContain("Oil");
    expect(out).toMatch(/href="\/site-a"/);
    expect(out).toContain("data-tag-chip");
  });

  it("keeps the current view in every link", () => {
    const out = html(<FilterRail sections={buildSections(works, {})} filters={{}} basePath="" view="index" />);
    expect(out).toContain('href="/?medium=oil-on-linen&amp;view=index"');
  });

  it("renders nothing for a site with no medium, project or year to filter by", () => {
    expect(html(<FilterRail sections={[]} filters={{}} basePath="" view="grid" />)).toBe("");
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

  it("reserves the picture's exact space before it loads, from its width and proportions", () => {
    const out = html(<MediaView media={image()} alt="Harbour" priority name="blue-hour" />);
    expect(out).toContain("--ar:1.5000");
    expect(out).toContain("--w:3000px");
    expect(html(<MediaView media={video()} alt="" priority={false} />)).toContain("--w:3000px");
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
  const base = { siteName: "Jacob", basePath: "/site-a", links: [], prev: null, next: null, wrapped: false };
  const neighbour = (slug: string, title: string) => ({ slug, title, cover: image({ src: `/media/1/${slug}/w1200` }) });

  it("shows the title, details, linked tags and previous work", () => {
    const w = work("blue-hour", {
      title: "Blue Hour",
      details: [{ key: "medium", label: "Medium", value: "Oil", type: "text" }],
      tags: [{ name: "Oil", slug: "oil" }],
    });
    const out = html(<WorkPage {...base} work={w} prev={neighbour("newer", "Newer")} next={neighbour("older", "Older")} />);
    expect(out).toContain("<h1");
    expect(out).toContain("Blue Hour");
    expect(out).toContain("Medium");
    expect(out).toContain("Oil");
    expect(out).toContain('href="/site-a?tag=oil"');
    expect(out).toMatch(/<a[^>]*rel="prev"[^>]*href="\/site-a\/work\/newer"|<a[^>]*href="\/site-a\/work\/newer"[^>]*rel="prev"/);
  });

  it("ends with the next work as a large finale, showing its picture and title", () => {
    const out = html(<WorkPage {...base} work={work("a")} next={neighbour("older", "Older Piece")} />);
    expect(out).toMatch(/<a[^>]*rel="next"[^>]*href="\/site-a\/work\/older"|<a[^>]*href="\/site-a\/work\/older"[^>]*rel="next"/);
    expect(out).toContain("Next work");
    expect(out).toContain("Older Piece");
    expect(out).toContain('src="/media/1/older/w1200"');
  });

  it("says it is going back to the start when the next work wraps around", () => {
    const out = html(<WorkPage {...base} work={work("last")} next={neighbour("first", "First")} wrapped />);
    expect(out).toContain("Back to the start");
    expect(out).not.toContain("Next work");
  });

  it("has no finale when it is the only work", () => {
    const out = html(<WorkPage {...base} work={work("only")} />);
    expect(out).not.toContain('rel="next"');
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

  it("links medium, project and year back into the gallery, filtered to that value", () => {
    const out = html(<WorkPage {...base} work={work("a", { details: [
      { key: "medium", label: "Medium", value: "Oil on linen", type: "text" },
      { key: "project", label: "Project", value: "Harbour Series", type: "text" },
      { key: "year", label: "Year", value: "2025", type: "text" },
      { key: "dimensions", label: "Dimensions", value: "90 × 120 cm", type: "text" },
    ] })} />);
    expect(out).toContain('href="/site-a?medium=oil-on-linen"');
    expect(out).toContain('href="/site-a?project=harbour-series"');
    expect(out).toContain('href="/site-a?year=2025"');
    expect(out).not.toContain("dimensions=");
  });

  it("sets a long description apart from the short details", () => {
    const out = html(<WorkPage {...base} work={work("a", { details: [{ key: "description", label: "Description", value: "A long note about the piece.", type: "longtext" }, { key: "year", label: "Year", value: "2025", type: "text" }] })} />);
    expect(out).toContain("A long note about the piece.");
    expect(out).toContain("2025");
  });
});

describe("AboutPage", () => {
  const base = { siteName: "Jacob", basePath: "" };
  it("turns blank-line separated text into paragraphs and never renders HTML", () => {
    const out = html(<AboutPage {...base} about={"First paragraph.\n\nSecond <b>one</b>."} links={[]} />);
    expect(out.match(/<p/g)!.length).toBeGreaterThanOrEqual(2);
    expect(out).toContain("First paragraph.");
    expect(out).toContain("&lt;b&gt;one&lt;/b&gt;");
    expect(out).not.toContain("<b>one");
  });

  it("lists only http(s) links, opening in a new tab safely", () => {
    const out = html(<AboutPage {...base} about="x" links={[{ label: "Instagram", url: "https://instagram.com/x" }, { label: "Bad", url: "javascript:alert(1)" }]} />);
    expect(out).toContain('href="https://instagram.com/x"');
    expect(out).toContain('rel="noopener noreferrer"');
    expect(out).not.toContain("javascript:");
    expect(out).not.toContain("Bad");
  });

  it("says so when there is nothing to show yet", () => {
    expect(html(<AboutPage {...base} about="" links={[]} />)).toContain("Nothing here yet.");
  });
});

describe("IndexPage", () => {
  const props = { siteName: "Jacob", basePath: "/site-a", rowHeight: 320, showCaptions: false, tagline: "Painter.", links: [], view: "grid" as const, filters: {} };
  const detail = (key: string, label: string, value: string) => ({ key, label, value, type: "text" as const });
  const a = work("a", { details: [detail("medium", "Medium", "Oil"), detail("year", "Year", "2024")] });
  const b = work("b", { details: [detail("medium", "Medium", "Ink"), detail("year", "Year", "2022")] });

  it("opens with the artist's name, counting the works and spanning their years", () => {
    const out = html(<IndexPage {...props} works={[a, b]} />);
    expect(out).toMatch(/<h1[^>]*>Jacob<\/h1>/);
    expect(out).toContain("2 works");
    expect(out).toContain("2022–2024");
  });

  it("puts the filters in a rail beside the gallery, built from the works' medium and year", () => {
    const out = html(<IndexPage {...props} works={[a, b]} />);
    expect(out).toContain("data-filter-rail");
    expect(out).toContain(">Medium<");
    expect(out).toContain(">Year<");
    expect(out).toContain('href="/site-a?medium=oil"');
  });

  it("keeps every work on the page but hides those the filters rule out, and counts what is left", () => {
    const out = html(<IndexPage {...props} filters={{ medium: "oil" }} works={[a, b]} />);
    expect(out.match(/data-work=/g)).toHaveLength(2);
    expect(out.match(/<li[^>]*hidden/g)).toHaveLength(1);
    expect(out).toContain("1 of 2 works");
  });

  it("says when nothing matches, with a way back", () => {
    const out = html(<IndexPage {...props} filters={{ medium: "oil", year: "2022" }} works={[a, b]} />);
    expect(out).toContain("data-empty-state");
    expect(out).not.toMatch(/data-empty-state[^>]*hidden/);
    expect(html(<IndexPage {...props} works={[a, b]} />)).toMatch(/data-empty-state[^>]*hidden|hidden[^>]*data-empty-state/);
  });

  it("shows the picture grid by default and the typographic index on request", () => {
    const grid = html(<IndexPage {...props} works={[a, b]} />);
    const index = html(<IndexPage {...props} view="index" works={[a, b]} />);
    expect(grid).toContain('data-captions="hover"');
    expect(index).not.toContain("data-captions");
    expect(index).toContain('data-view-mode="index"');
  });

  it("runs a strip of the mediums across the page, and ends with the footer", () => {
    const out = html(<IndexPage {...props} works={[a, b]} />);
    expect(out).toContain('aria-hidden="true"');
    expect(out).toMatch(/© \d{4}/);
  });

  it("is just the gallery, with no rail, when there is nothing to filter by", () => {
    const out = html(<IndexPage {...props} works={[work("x")]} />);
    expect(out).not.toContain("data-filter-rail");
  });

  it("explains an empty gallery", () => {
    expect(html(<IndexPage {...props} works={[]} />)).toContain("Nothing here yet.");
  });
});

describe("RootPage", () => {
  it("links to every site", () => {
    const out = html(<RootPage sites={[{ name: "Site A", slug: "site-a" }, { name: "Site B", slug: "site-b" }]} />);
    expect(out).toContain('href="/site-a"');
    expect(out).toContain("Site B");
  });
});

const post = (over: Partial<PublicPost> = {}): PublicPost => ({ id: 1, createdAt: "2026-11-04T18:30:00.000Z", body: "", media: [], ...over });

describe("StudioPost", () => {
  it("sets a thought as typography with its date, with no picture", () => {
    const out = html(<StudioPost post={post({ body: "Work slowly.\n\nLook longer." })} tone={1} priority={false} />);
    expect(out).toContain("Work slowly.");
    expect(out).toContain("Look longer.");
    expect(out).toContain('datetime="2026-11-04T18:30:00.000Z"');
    expect(out).toContain("4 Nov 2026");
    expect(out).toContain('data-tone="1"');
    expect(out).toContain("data-short");
    expect(out).not.toContain("<img");
  });
  it("shows a photo with its caption, linked to the original, lazy unless it leads the feed", () => {
    const lazy = html(<StudioPost post={post({ body: "Studio light", media: [image()] })} tone={0} priority={false} />);
    expect(lazy).toContain("Studio light");
    expect(lazy).toContain('data-full="/media/1/7/original"');
    expect(lazy).toContain('loading="lazy"');
    expect(html(<StudioPost post={post({ media: [image()] })} tone={0} priority />)).not.toContain('loading="lazy"');
  });
  it("shows a short clip that loops silently, and a post of several pictures in order", () => {
    const clip = html(<StudioPost post={post({ media: [video()] })} tone={0} priority={false} />);
    expect(clip).toContain("<video");
    expect(clip).toContain("data-autoplay");
    expect(clip).toContain("muted");
    const many = html(<StudioPost post={post({ media: [image({ src: "/a" }), image({ src: "/b" })] })} tone={0} priority={false} />);
    expect(many.indexOf('src="/a"')).toBeLessThan(many.indexOf('src="/b"'));
  });
  it("escapes the words so nothing in a post can run as markup", () => {
    expect(html(<StudioPost post={post({ body: "<script>x</script>" })} tone={0} priority={false} />)).not.toContain("<script>");
  });
});

describe("StudioPage", () => {
  it("lists posts newest first as given, with the Studio link marked current", () => {
    const out = html(<StudioPage siteName="Jacob" basePath="/site-a" posts={[post({ id: 2, body: "second" }), post({ id: 1, body: "first" })]} links={[]} />);
    expect(out.indexOf("second")).toBeLessThan(out.indexOf("first"));
    expect(out).toMatch(/href="\/site-a\/studio"[^>]*aria-current="page"/);
  });
  it("only carries the full-size viewer when there is a picture to open", () => {
    expect(html(<StudioPage siteName="J" basePath="" posts={[post({ body: "t" })]} links={[]} />)).not.toContain("data-lightbox");
    expect(html(<StudioPage siteName="J" basePath="" posts={[post({ media: [image()] })]} links={[]} />)).toContain("data-lightbox");
  });
  it("says so when there is nothing yet", () => {
    expect(html(<StudioPage siteName="J" basePath="" posts={[]} links={[]} />)).toContain("Nothing here yet.");
  });
});
