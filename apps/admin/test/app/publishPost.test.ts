import { describe, expect, it, vi } from "vitest";
import { publishPost, type PublishDeps } from "../../src/app/lib/publishPost";

const POST = { id: 5, updatedAt: "t0", body: "", visible: false };

function setup(upload: PublishDeps["upload"]) {
  const calls: Array<[string, string, unknown?]> = [];
  const api = vi.fn(async (method: string, path: string, body?: unknown) => {
    calls.push([method, path, body]);
    if (method === "POST") return POST;
    if (method === "PATCH") return { work: { ...POST, ...(body as object), updatedAt: "t1" } };
    return undefined;
  }) as unknown as PublishDeps["api"];
  return { calls, deps: { api, upload } };
}
const file = new File(["x"], "a.jpg", { type: "image/jpeg" });

describe("publishPost", () => {
  it("does nothing for an empty post", async () => {
    const { calls, deps } = setup(vi.fn());
    expect(await publishPost({ body: "  ", files: [] }, () => {}, deps)).toEqual({ status: "empty" });
    expect(calls).toEqual([]);
  });

  it("posts a thought: creates it, then shows it with its words and no uploads", async () => {
    const { calls, deps } = setup(vi.fn(async () => ({ ok: 0, failed: 0 })));
    const res = await publishPost({ body: " A little thought. ", files: [] }, () => {}, deps);
    expect(res).toMatchObject({ status: "published", failed: 0 });
    expect(calls).toEqual([
      ["POST", "/api/studio", undefined],
      ["PATCH", "/api/works/5", { body: "A little thought.", visible: true, expectedUpdatedAt: "t0" }],
    ]);
  });

  it("keeps the post hidden until its files are in, then shows it", async () => {
    const order: string[] = [];
    const { deps } = setup(vi.fn(async () => (order.push("upload"), { ok: 1, failed: 0 })));
    const api = deps.api;
    deps.api = (async (...a: Parameters<typeof api>) => (order.push(a[0]), api(...a))) as typeof api;
    await publishPost({ body: "", files: [file] }, () => {}, deps);
    expect(order).toEqual(["POST", "upload", "PATCH"]);
  });

  it("publishes what did upload and reports how many files failed", async () => {
    const { deps } = setup(vi.fn(async () => ({ ok: 1, failed: 2 })));
    expect(await publishPost({ body: "", files: [file, file, file] }, () => {}, deps)).toMatchObject({ status: "published", failed: 2 });
  });

  it("removes the empty post when every file fails and there are no words", async () => {
    const { calls, deps } = setup(vi.fn(async () => ({ ok: 0, failed: 1 })));
    expect(await publishPost({ body: "", files: [file] }, () => {}, deps)).toEqual({ status: "failed" });
    expect(calls.at(-1)).toEqual(["DELETE", "/api/works/5", undefined]);
  });

  it("still posts the words when every file fails", async () => {
    const { deps } = setup(vi.fn(async () => ({ ok: 0, failed: 1 })));
    expect(await publishPost({ body: "words", files: [file] }, () => {}, deps)).toMatchObject({ status: "published", failed: 1 });
  });
});
