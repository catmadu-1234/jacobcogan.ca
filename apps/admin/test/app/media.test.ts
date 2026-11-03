import { describe, expect, it } from "vitest";
import type { Media } from "@senka/core/types";
import { fileUrl, thumbUrl } from "../../src/app/lib/media";

const media = (over: Partial<Media>): Media => ({
  id: 7, siteId: 1, workId: 1, kind: "image", status: "ready", mime: "image/jpeg", width: 1, height: 1,
  duration: null, color: null, alt: "", variants: ["original"], bytes: 1, sort: 1, createdAt: "", ...over,
});

describe("media urls", () => {
  it("builds owner-preview URLs", () => {
    expect(fileUrl(7, "w480")).toBe("/api/media/7/file/w480");
  });
  it("uses the smallest suitable image variant for thumbnails", () => {
    expect(thumbUrl(media({ variants: ["original", "w480", "w1200"] }))).toBe("/api/media/7/file/w480");
    expect(thumbUrl(media({ variants: ["original", "w1200"] }))).toBe("/api/media/7/file/w1200");
    expect(thumbUrl(media({ variants: ["original"] }))).toBe("/api/media/7/file/original");
  });
  it("uses the poster for videos and nothing when there is none", () => {
    expect(thumbUrl(media({ kind: "video", variants: ["original", "poster"] }))).toBe("/api/media/7/file/poster");
    expect(thumbUrl(media({ kind: "video", variants: ["original"] }))).toBeNull();
  });
});
