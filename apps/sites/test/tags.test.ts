import { describe, expect, it } from "vitest";
import type { PublicWork } from "@senka/core";
import { collectTags } from "../src/lib/tags";

const work = (slug: string, tags: string[]): PublicWork => ({
  slug, title: slug, details: [], media: [], cover: null, updatedAt: "",
  tags: tags.map((t) => ({ name: t, slug: t.toLowerCase() })),
});

describe("collectTags", () => {
  it("counts the works using each tag and sorts by name, ignoring case", () => {
    const tags = collectTags([work("a", ["Painting", "Oil"]), work("b", ["oil"].map((t) => t[0]!.toUpperCase() + t.slice(1))), work("c", ["Drawing"])]);
    expect(tags).toEqual([
      { name: "Drawing", slug: "drawing", count: 1 },
      { name: "Oil", slug: "oil", count: 2 },
      { name: "Painting", slug: "painting", count: 1 },
    ]);
  });
  it("returns nothing when no work has tags", () => {
    expect(collectTags([work("a", [])])).toEqual([]);
  });
});
