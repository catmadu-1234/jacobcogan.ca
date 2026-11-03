import { describe, expect, it, vi } from "vitest";
import { MAX_UPLOAD_BYTES, type Media } from "@senka/core/types";
import { createUploader, resolveMime, type Prepared, type UploaderDeps } from "../../src/app/lib/upload/uploader";

const file = (name: string, type: string, size = 10) => {
  const f = new File([new Uint8Array(Math.min(size, 10))], name, { type });
  if (size !== f.size) Object.defineProperty(f, "size", { value: size });
  return f;
};

const prepared = (over: Partial<Prepared> = {}): Prepared => ({
  kind: "image", mime: "image/jpeg", width: 100, height: 50, color: "#aabbcc", hevc: false,
  blobs: [{ variant: "original", blob: new Blob(["o"]) }, { variant: "w480", blob: new Blob(["w"], { type: "image/webp" }) }],
  ...over,
});

function deps(over: Partial<UploaderDeps> = {}) {
  const calls: Array<[string, string, unknown?]> = [];
  const d: UploaderDeps = {
    prepare: vi.fn(async () => prepared()),
    api: vi.fn(async (method: string, path: string, body?: unknown) => {
      calls.push([method, path, body]);
      if (method === "POST") return { id: 7, workId: 3 } as unknown as Media;
      return { id: 7, status: "ready" } as unknown as Media;
    }) as UploaderDeps["api"],
    putBlob: vi.fn(async (_path: string, _blob: Blob, onProgress: (loaded: number) => void) => onProgress(1)),
    previewUrl: () => "blob:preview",
    ...over,
  };
  return { d, calls };
}

const settle = () => new Promise((r) => setTimeout(r, 0));
async function waitFor(fn: () => boolean) {
  for (let i = 0; i < 200 && !fn(); i++) await settle();
  expect(fn()).toBe(true);
}

describe("resolveMime", () => {
  it("accepts the supported types, falling back to the file extension", () => {
    expect(resolveMime(file("a.jpg", "image/jpeg"))).toBe("image/jpeg");
    expect(resolveMime(file("clip.MOV", ""))).toBe("video/quicktime");
    expect(resolveMime(file("clip.m4v", ""))).toBe("video/mp4");
  });
  it("rejects everything else", () => {
    expect(resolveMime(file("a.svg", "image/svg+xml"))).toBeNull();
    expect(resolveMime(file("a.heic", "image/heic"))).toBeNull();
    expect(resolveMime(file("a.pdf", "application/pdf"))).toBeNull();
  });
});

describe("uploader", () => {
  it("refuses files over 90 MB without calling the server", async () => {
    const { d, calls } = deps();
    const up = createUploader(3, vi.fn(), d);
    up.add([file("big.mov", "video/quicktime", 95 * 1024 * 1024)]);
    await waitFor(() => up.items.get()[0]?.state === "error");
    expect(up.items.get()[0]!.error).toBe("This file is over 90 MB. Try exporting a shorter or smaller version.");
    expect(calls).toEqual([]);
    expect(d.prepare).not.toHaveBeenCalled();
    expect(95 * 1024 * 1024).toBeGreaterThan(MAX_UPLOAD_BYTES);
  });

  it("refuses unsupported types with a plain message", async () => {
    const { d, calls } = deps();
    const up = createUploader(3, vi.fn(), d);
    up.add([file("a.heic", "image/heic")]);
    await waitFor(() => up.items.get()[0]?.state === "error");
    expect(up.items.get()[0]!.error).toMatch(/JPEG, PNG, WebP, GIF, AVIF, MP4, WebM or MOV/);
    expect(calls).toEqual([]);
  });

  it("uploads each variant, marks ready and reports done in order", async () => {
    const { d, calls } = deps();
    const onDone = vi.fn();
    const up = createUploader(3, onDone, d);
    up.add([file("a.jpg", "image/jpeg"), file("b.jpg", "image/jpeg")]);
    await waitFor(() => up.items.get().every((i) => i.state === "done"));
    expect(onDone).toHaveBeenCalledTimes(2);
    expect(up.items.get().map((i) => i.name)).toEqual(["a.jpg", "b.jpg"]);
    const first = calls.filter((c) => c[0] === "POST")[0]!;
    expect(first[1]).toBe("/api/works/3/media");
    expect(first[2]).toMatchObject({ kind: "image", mime: "image/jpeg", width: 100, height: 50, color: "#aabbcc", bytes: 10, variants: ["original", "w480"] });
    expect(calls.some((c) => c[0] === "PATCH" && c[1] === "/api/media/7" && (c[2] as any).status === "ready")).toBe(true);
    expect((d.putBlob as any).mock.calls.map((c: any[]) => c[0])).toContain("/api/media/7/blob/w480");
  });

  it("warns about HEVC video but still uploads it", async () => {
    const { d } = deps({ prepare: vi.fn(async () => prepared({ kind: "video", mime: "video/quicktime", hevc: true, blobs: [{ variant: "original", blob: new Blob(["v"]) }] })) });
    const up = createUploader(3, vi.fn(), d);
    up.add([file("clip.mov", "video/quicktime")]);
    await waitFor(() => up.items.get()[0]?.state === "done");
    expect(up.items.get()[0]!.warning).toBe(
      "This video uses a format some browsers can't play. On iPhone: Settings → Camera → Formats → Most Compatible, or export again.",
    );
  });

  it("shows a friendly error and cleans up the half-created media when the upload fails", async () => {
    const { d, calls } = deps({ putBlob: vi.fn(async () => { throw new Error("network"); }) });
    const up = createUploader(3, vi.fn(), d);
    up.add([file("a.jpg", "image/jpeg")]);
    await waitFor(() => up.items.get()[0]?.state === "error");
    expect(up.items.get()[0]!.error).toBe("Upload failed. Check your connection and try again.");
    expect(calls.some((c) => c[0] === "DELETE" && c[1] === "/api/media/7")).toBe(true);
  });

  it("explains an unreadable image", async () => {
    const { d } = deps({ prepare: vi.fn(async () => { throw new Error("decode"); }) });
    const up = createUploader(3, vi.fn(), d);
    up.add([file("a.jpg", "image/jpeg")]);
    await waitFor(() => up.items.get()[0]?.state === "error");
    expect(up.items.get()[0]!.error).toBe("This file can't be read. Try a JPEG or PNG.");
  });

  it("retries a failed file from scratch", async () => {
    let fail = true;
    const { d } = deps({ putBlob: vi.fn(async () => { if (fail) throw new Error("x"); }) });
    const onDone = vi.fn();
    const up = createUploader(3, onDone, d);
    up.add([file("a.jpg", "image/jpeg")]);
    await waitFor(() => up.items.get()[0]?.state === "error");
    fail = false;
    up.retry(up.items.get()[0]!.localId);
    await waitFor(() => up.items.get()[0]?.state === "done");
    expect(onDone).toHaveBeenCalledOnce();
  });

  it("works on at most two files at a time", async () => {
    let active = 0;
    let peak = 0;
    const { d } = deps({
      prepare: vi.fn(async () => {
        active++;
        peak = Math.max(peak, active);
        await new Promise((r) => setTimeout(r, 5));
        active--;
        return prepared();
      }),
    });
    const up = createUploader(3, vi.fn(), d);
    up.add(Array.from({ length: 5 }, (_, i) => file(`f${i}.jpg`, "image/jpeg")));
    await waitFor(() => up.items.get().every((i) => i.state === "done"));
    expect(peak).toBe(2);
  });
});
