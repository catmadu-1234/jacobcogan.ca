import { describe, it, expect } from "vitest";
import { MAX_UPLOAD_BYTES, MediaCreate } from "../src";

const base = { kind: "image", mime: "image/jpeg", width: 10, height: 10, bytes: 1, variants: ["original"] };

describe("MediaCreate", () => {
  it("accepts allowed image and video types", () => {
    for (const mime of ["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif", "video/mp4", "video/webm", "video/quicktime"]) {
      expect(MediaCreate.safeParse({ ...base, mime }).success, mime).toBe(true);
    }
  });
  it("rejects types that must never be served from the public site", () => {
    for (const mime of ["text/html", "image/svg+xml", "application/javascript", "application/pdf", "image/jpeg; charset=x"]) {
      expect(MediaCreate.safeParse({ ...base, mime }).success, mime).toBe(false);
    }
  });
  it("rejects files over the upload cap, empty variant lists and unknown variants", () => {
    expect(MediaCreate.safeParse({ ...base, bytes: MAX_UPLOAD_BYTES + 1 }).success).toBe(false);
    expect(MediaCreate.safeParse({ ...base, variants: [] }).success).toBe(false);
    expect(MediaCreate.safeParse({ ...base, variants: ["w9999"] }).success).toBe(false);
  });
});
