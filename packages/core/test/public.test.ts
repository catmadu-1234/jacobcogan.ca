import { env } from "cloudflare:test";
import { describe, it, expect } from "vitest";
import {
  listPublicWorks, getPublicWork, toPublicMedia, getSiteById, createFieldDef,
  updateFieldDef, softDeleteWork, listPublicPosts, getWork, updateWork, type Media,
} from "../src";
import { seedTwoSites, addWork } from "./fixtures";

const db = () => env.DB;
const site = async (id: number) => (await getSiteById(db(), id))!;

describe("toPublicMedia", () => {
  const base = { siteId: 1, id: 7, workId: 1, status: "ready", mime: "image/webp", width: 3000, height: 2000, duration: null, color: "#aabbcc", alt: "alt", bytes: 1, sort: 1, createdAt: "" } as const;

  it("builds srcset from width variants and picks the largest as src", () => {
    const m: Media = { ...base, kind: "image", variants: ["original", "w480", "w1200"] };
    const p = toPublicMedia(m, "/media");
    expect(p.srcset).toBe("/media/1/7/w480 480w, /media/1/7/w1200 1200w");
    expect(p.src).toBe("/media/1/7/w1200");
    expect(p).toMatchObject({ width: 3000, height: 2000, color: "#aabbcc", alt: "alt", poster: null });
  });

  it("links the untouched original for the lightbox", () => {
    const m: Media = { ...base, kind: "image", variants: ["original", "w480", "w1200"] };
    expect(toPublicMedia(m, "/media").full).toBe("/media/1/7/original");
    const v: Media = { ...base, kind: "video", variants: ["original", "poster"] };
    expect(toPublicMedia(v, "/media").full).toBe("/media/1/7/original");
  });

  it("falls back to the original when no width variants exist", () => {
    const p = toPublicMedia({ ...base, kind: "image", variants: ["original"] }, "/media");
    expect(p.src).toBe("/media/1/7/original");
    expect(p.srcset).toBeNull();
  });

  it("serves videos from the original with a poster", () => {
    const p = toPublicMedia({ ...base, kind: "video", duration: 12, variants: ["original", "poster"] }, "https://media.example.com");
    expect(p.src).toBe("https://media.example.com/1/7/original");
    expect(p.poster).toBe("https://media.example.com/1/7/poster");
    expect(p.srcset).toBeNull();
    expect(p.duration).toBe(12);
  });
});

describe("public works", () => {
  it("never includes hidden, deleted or pending-only works", async () => {
    const { a } = await seedTwoSites(db());
    await addWork(db(), a, { title: "Shown" });
    await addWork(db(), a, { title: "Hidden", visible: false });
    const { work: deleted } = await addWork(db(), a, { title: "Deleted" });
    await softDeleteWork(db(), a, deleted.id);
    await addWork(db(), a, { title: "Pending only", media: [{ ready: false }] });
    const list = await listPublicWorks(db(), await site(a), "/media");
    expect(list.map((w) => w.title)).toEqual(["Shown"]);
  });

  it("returns null for hidden, deleted and pending-only slugs", async () => {
    const { a } = await seedTwoSites(db());
    const { work: hidden } = await addWork(db(), a, { title: "Hidden", visible: false });
    const { work: deleted } = await addWork(db(), a, { title: "Deleted" });
    await softDeleteWork(db(), a, deleted.id);
    const { work: pending } = await addWork(db(), a, { title: "Pending", media: [{ ready: false }] });
    const s = await site(a);
    for (const w of [hidden, deleted, pending]) expect(await getPublicWork(db(), s, w.slug, "/media")).toBeNull();
  });

  it("does not return another site's work by slug", async () => {
    const { a, b } = await seedTwoSites(db());
    const { work } = await addWork(db(), a, { title: "Mine" });
    expect(await getPublicWork(db(), await site(b), work.slug, "/media")).toBeNull();
    expect(await listPublicWorks(db(), await site(b), "/media")).toEqual([]);
  });

  it("lists details in definition order, skipping archived and empty ones", async () => {
    const { a } = await seedTwoSites(db());
    const medium = await createFieldDef(db(), a, { label: "Medium", type: "text", required: false });
    const year = await createFieldDef(db(), a, { label: "Year", type: "text", required: false });
    const old = await createFieldDef(db(), a, { label: "Old", type: "text", required: false });
    const empty = await createFieldDef(db(), a, { label: "Empty", type: "text", required: false });
    await updateFieldDef(db(), a, old.id, { archived: true });
    await addWork(db(), a, { title: "W", fields: { [year.key]: "2024", [medium.key]: "Oil", [old.key]: "x", [empty.key]: "" } });
    const [w] = await listPublicWorks(db(), await site(a), "/media");
    expect(w!.details).toEqual([
      { key: "medium", label: "Medium", value: "Oil", type: "text" },
      { key: "year", label: "Year", value: "2024", type: "text" },
    ]);
  });

  it("shows only ready media, picks a cover and exposes tags", async () => {
    const { a } = await seedTwoSites(db());
    await addWork(db(), a, { title: "W", tags: ["Oil"], media: [{ ready: false }, { ready: true }] });
    const [w] = await listPublicWorks(db(), await site(a), "/media");
    expect(w!.media).toHaveLength(1);
    expect(w!.cover).toEqual(w!.media[0]);
    expect(w!.tags).toEqual([{ name: "Oil", slug: "oil" }]);
  });

  it("filters by tag slug", async () => {
    const { a } = await seedTwoSites(db());
    await addWork(db(), a, { title: "Painted", tags: ["Painting"] });
    await addWork(db(), a, { title: "Drawn", tags: ["Drawing"] });
    const list = await listPublicWorks(db(), await site(a), "/media", { tagSlug: "drawing" });
    expect(list.map((w) => w.title)).toEqual(["Drawn"]);
  });

  it("links previous and next in list order", async () => {
    const { a } = await seedTwoSites(db());
    await addWork(db(), a, { title: "One" });
    await addWork(db(), a, { title: "Two" });
    await addWork(db(), a, { title: "Three" });
    const s = await site(a);
    const titles = (await listPublicWorks(db(), s, "/media")).map((w) => w.title);
    expect(titles).toEqual(["Three", "Two", "One"]);
    const middle = await getPublicWork(db(), s, "two", "/media");
    expect(middle!.prev).toEqual({ slug: "three", title: "Three" });
    expect(middle!.next).toEqual({ slug: "one", title: "One" });
    const first = await getPublicWork(db(), s, "three", "/media");
    expect(first!.prev).toBeNull();
  });

  it("handles more than 100 works without bound-parameter limits", async () => {
    const { a } = await seedTwoSites(db());
    for (let i = 0; i < 105; i++) await addWork(db(), a, { title: `Work ${i}` });
    expect(await listPublicWorks(db(), await site(a), "/media")).toHaveLength(105);
  });
});

describe("studio posts", () => {
  it("keeps posts out of the portfolio works, their navigation and their pages", async () => {
    const { a } = await seedTwoSites(db());
    const s = await site(a);
    await addWork(db(), a, { title: "Painting" });
    const { work: post } = await addWork(db(), a, { title: "", kind: "post", body: "hi" });
    expect((await listPublicWorks(db(), s, "/media")).map((w) => w.title)).toEqual(["Painting"]);
    expect(await getPublicWork(db(), s, post.slug, "/media")).toBeNull();
    expect((await getPublicWork(db(), s, (await listPublicWorks(db(), s, "/media"))[0]!.slug, "/media"))!.next).toBeNull();
  });

  it("lists visible posts newest first: thoughts, photos and clips", async () => {
    const { a, b } = await seedTwoSites(db());
    const s = await site(a);
    await addWork(db(), a, { title: "", kind: "post", body: "first thought", media: [] });
    await addWork(db(), a, { title: "", kind: "post", body: "a caption", media: [{}] });
    await addWork(db(), a, { title: "", kind: "post", body: "", media: [{ kind: "video" }] });
    await addWork(db(), a, { title: "", kind: "post", body: "hidden", visible: false, media: [] });
    await addWork(db(), a, { title: "", kind: "post", body: "pictureless and wordless", media: [] }).then(async (r) => {
      await updateWork(db(), a, r.work.id, { body: "", expectedUpdatedAt: (await getWork(db(), a, r.work.id))!.updatedAt });
    });
    await addWork(db(), b, { title: "", kind: "post", body: "other site", media: [] });
    await addWork(db(), a, { title: "", kind: "post", body: "unfinished upload", media: [{ ready: false }] });
    const posts = await listPublicPosts(db(), s, "/media");
    expect(posts.map((p) => [p.body, p.media.length])).toEqual([
      ["unfinished upload", 0],
      ["", 1],
      ["a caption", 1],
      ["first thought", 0],
    ]);
    expect(posts[1]!.media[0]!.kind).toBe("video");
    expect(posts[0]).toMatchObject({ createdAt: expect.any(String), id: expect.any(Number) });
  });
});
