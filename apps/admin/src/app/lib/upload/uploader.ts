import { ALLOWED_MIME, MAX_UPLOAD_BYTES, type Media, type MediaVariant } from "@senka/core/types";
import { ApiError, api as realApi } from "../api";
import { createStore, type Store } from "../store";
import { makeImageVariants } from "./resize";
import { videoInfo } from "./video";

export type Mime = (typeof ALLOWED_MIME)[number];
export type UploadState = "preparing" | "uploading" | "processing" | "done" | "error";

export interface UploadItem {
  localId: string;
  name: string;
  state: UploadState;
  /** 0..1 across every variant of the file. */
  progress: number;
  error?: string;
  warning?: string;
  /** Local object URL so a tile can show the picture straight away. */
  preview: string;
}

export interface Prepared {
  kind: "image" | "video";
  mime: Mime;
  width: number;
  height: number;
  duration?: number;
  color: string;
  hevc: boolean;
  blobs: Array<{ variant: MediaVariant; blob: Blob }>;
}

export interface UploaderDeps {
  prepare(file: File, mime: Mime): Promise<Prepared>;
  api: typeof realApi;
  putBlob(path: string, blob: Blob, onProgress: (loaded: number) => void): Promise<void>;
  previewUrl(file: File): string;
}

export const TOO_BIG = "This file is over 90 MB. Try exporting a shorter or smaller version.";
const UNSUPPORTED = "That file type isn't supported. Use JPEG, PNG, WebP, GIF, AVIF, MP4, WebM or MOV.";
const UNREADABLE = "This file can't be read. Try a JPEG or PNG.";
const FAILED = "Upload failed. Check your connection and try again.";
const HEVC_WARNING =
  "This video uses a format some browsers can't play. On iPhone: Settings → Camera → Formats → Most Compatible, or export again.";

const BY_EXTENSION: Record<string, Mime> = {
  jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", gif: "image/gif", avif: "image/avif",
  mp4: "video/mp4", m4v: "video/mp4", webm: "video/webm", mov: "video/quicktime",
};

/** The file's content type if it is one we accept, using the extension when the browser reports none. */
export function resolveMime(file: File): Mime | null {
  if ((ALLOWED_MIME as readonly string[]).includes(file.type)) return file.type as Mime;
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  return BY_EXTENSION[ext] ?? null;
}

function xhrPut(path: string, blob: Blob, onProgress: (loaded: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", path);
    xhr.setRequestHeader("content-type", blob.type || "application/octet-stream");
    xhr.upload.onprogress = (e) => onProgress(e.loaded);
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new ApiError(xhr.status, xhr.responseText)));
    xhr.onerror = () => reject(new Error("network"));
    xhr.send(blob);
  });
}

const defaultDeps: UploaderDeps = {
  async prepare(file, mime) {
    if (mime.startsWith("video/")) {
      const info = await videoInfo(file);
      return {
        kind: "video", mime, width: info.width, height: info.height, duration: info.duration, color: info.color, hevc: info.hevc,
        blobs: [{ variant: "original", blob: file }, { variant: "poster", blob: info.poster }],
      };
    }
    const img = await makeImageVariants(file, mime);
    return { kind: "image", mime, width: img.width, height: img.height, color: img.color, hevc: false, blobs: img.variants };
  },
  api: realApi,
  putBlob: xhrPut,
  previewUrl: (file) => URL.createObjectURL(file),
};

const CONCURRENCY = 2;

/** Prepares (resizes) and uploads files to one work, two at a time, reporting per-file progress. */
export function createUploader(workId: number, onDone: (media: Media) => void, deps: UploaderDeps = defaultDeps) {
  const items: Store<UploadItem[]> = createStore<UploadItem[]>([]);
  const files = new Map<string, File>();
  const queue: string[] = [];
  let active = 0;
  let seq = 0;

  const patch = (id: string, changes: Partial<UploadItem>) =>
    items.set((list) => list.map((i) => (i.localId === id ? { ...i, ...changes } : i)));

  async function run(id: string): Promise<void> {
    const file = files.get(id)!;
    if (file.size > MAX_UPLOAD_BYTES) return patch(id, { state: "error", error: TOO_BIG });
    const mime = resolveMime(file);
    if (!mime) return patch(id, { state: "error", error: UNSUPPORTED });

    let mediaId: number | null = null;
    try {
      let prepared: Prepared;
      try {
        prepared = await deps.prepare(file, mime);
      } catch {
        return patch(id, { state: "error", error: UNREADABLE });
      }
      if (prepared.hevc) patch(id, { warning: HEVC_WARNING });

      patch(id, { state: "uploading", progress: 0 });
      const media = await deps.api<Media>("POST", `/api/works/${workId}/media`, {
        kind: prepared.kind, mime: prepared.mime, width: prepared.width, height: prepared.height,
        ...(prepared.duration !== undefined ? { duration: prepared.duration } : {}),
        color: prepared.color, bytes: file.size, variants: prepared.blobs.map((b) => b.variant),
      });
      mediaId = media.id;

      const total = prepared.blobs.reduce((sum, b) => sum + b.blob.size, 0) || 1;
      let sent = 0;
      for (const { variant, blob } of prepared.blobs) {
        await deps.putBlob(`/api/media/${media.id}/blob/${variant}`, blob, (loaded) => patch(id, { progress: Math.min(1, (sent + loaded) / total) }));
        sent += blob.size;
      }

      patch(id, { state: "processing", progress: 1 });
      const ready = await deps.api<Media>("PATCH", `/api/media/${media.id}`, { status: "ready" });
      patch(id, { state: "done" });
      onDone(ready);
    } catch (err) {
      if (mediaId !== null) await deps.api("DELETE", `/api/media/${mediaId}`).catch(() => {});
      patch(id, { state: "error", error: err instanceof ApiError && err.status === 413 ? TOO_BIG : FAILED });
    }
  }

  function pump(): void {
    while (active < CONCURRENCY && queue.length) {
      const id = queue.shift()!;
      active++;
      void run(id).finally(() => {
        active--;
        pump();
      });
    }
  }

  return {
    items,
    add(list: FileList | File[]): void {
      for (const file of Array.from(list)) {
        const id = `u${++seq}`;
        files.set(id, file);
        items.set((l) => [...l, { localId: id, name: file.name, state: "preparing", progress: 0, preview: deps.previewUrl(file) }]);
        queue.push(id);
      }
      pump();
    },
    retry(localId: string): void {
      if (!files.has(localId)) return;
      patch(localId, { state: "preparing", progress: 0, error: undefined, warning: undefined });
      queue.push(localId);
      pump();
    },
  };
}
