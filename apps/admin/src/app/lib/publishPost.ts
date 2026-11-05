import type { Media, Work } from "@senka/core/types";
import { api as realApi } from "./api";
import { createUploader } from "./upload/uploader";

export interface PublishProgress {
  total: number;
  finished: number;
}
export interface PublishDeps {
  api: typeof realApi;
  /** Uploads files to the given post; resolves once every file has finished or failed. */
  upload(postId: number, files: File[], onProgress: (p: PublishProgress) => void): Promise<{ ok: number; failed: number }>;
}
export type PublishResult =
  | { status: "published"; post: Work; failed: number }
  | { status: "empty" }
  | { status: "failed" };

const FINISHED = new Set(["done", "error"]);

/** The real uploader: resizes and sends each file, and reports when all of them are settled. */
export function uploadAll(postId: number, files: File[], onProgress: (p: PublishProgress) => void): Promise<{ ok: number; failed: number }> {
  return new Promise((resolve) => {
    if (files.length === 0) return resolve({ ok: 0, failed: 0 });
    const uploader = createUploader(postId, (_m: Media) => {});
    const check = () => {
      const items = uploader.items.get();
      const finished = items.filter((i) => FINISHED.has(i.state)).length;
      onProgress({ total: files.length, finished });
      if (items.length === files.length && finished === files.length) {
        stop();
        resolve({ ok: items.filter((i) => i.state === "done").length, failed: items.filter((i) => i.state === "error").length });
      }
    };
    const stop = uploader.items.subscribe(check);
    uploader.add(files);
  });
}

/**
 * Makes one Studio post: creates it hidden, uploads its pictures and clips, then shows it on the site. Posts
 * stay hidden until their files are in, so visitors never see half a post. If every file fails and there are
 * no words, the empty post is removed instead.
 */
export async function publishPost(
  input: { body: string; files: File[] },
  onProgress: (p: PublishProgress) => void,
  deps: PublishDeps = { api: realApi, upload: uploadAll },
): Promise<PublishResult> {
  const body = input.body.trim();
  if (!body && input.files.length === 0) return { status: "empty" };
  const post = await deps.api<Work>("POST", "/api/studio");
  const { ok, failed } = await deps.upload(post.id, input.files, onProgress);
  if (!body && ok === 0) {
    await deps.api("DELETE", `/api/works/${post.id}`).catch(() => {});
    return { status: "failed" };
  }
  const saved = await deps.api<{ work: Work }>("PATCH", `/api/works/${post.id}`, {
    body,
    visible: true,
    expectedUpdatedAt: post.updatedAt,
  });
  return { status: "published", post: saved.work, failed };
}
