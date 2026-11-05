import { useCallback, useEffect, useRef, useState } from "react";
import type { Media, Work } from "@senka/core/types";
import { api } from "./api";
import { publishPost, type PublishProgress } from "./publishPost";
import { showToast } from "./toast";

export type StudioPost = Work & { media: Media[] };
export type StudioState = "loading" | "ready" | "error";

/** The Studio feed in the admin: loading, posting, editing the words, showing or hiding, and deleting with Undo. */
export function useStudio() {
  const [posts, setPosts] = useState<StudioPost[]>([]);
  const [state, setState] = useState<StudioState>("loading");
  const [progress, setProgress] = useState<PublishProgress | null>(null);
  const [posting, setPosting] = useState(false);
  // Saves for one post run one after another, so each carries the latest `updatedAt`.
  const chains = useRef(new Map<number, Promise<unknown>>());
  const latest = useRef(posts);
  latest.current = posts;

  const load = useCallback(() => {
    setState("loading");
    api<StudioPost[]>("GET", "/api/studio")
      .then((list) => {
        setPosts(list);
        setState("ready");
      })
      .catch(() => setState("error"));
  }, []);
  useEffect(load, [load]);

  /** Returns true when the post went up, so the composer knows to clear itself. */
  async function post(body: string, files: File[]): Promise<boolean> {
    setPosting(true);
    setProgress(files.length ? { total: files.length, finished: 0 } : null);
    try {
      const result = await publishPost({ body, files }, setProgress);
      if (result.status === "failed") {
        showToast("None of those files could be uploaded. Check your connection and try again.");
        return false;
      }
      if (result.status === "published" && result.failed > 0) {
        showToast(`Posted, but ${result.failed} ${result.failed === 1 ? "file" : "files"} couldn't be uploaded.`);
      }
      load();
      return result.status === "published";
    } catch {
      showToast("Couldn't post. Check your connection and try again.");
      return false;
    } finally {
      setPosting(false);
      setProgress(null);
    }
  }

  function save(id: number, patch: { body?: string; visible?: boolean }): Promise<void> {
    setPosts((list) => list.map((p) => (p.id === id ? { ...p, ...patch } : p)));
    const run = async () => {
      const current = latest.current.find((p) => p.id === id);
      if (!current) return;
      try {
        const res = await api<{ work: Work }>("PATCH", `/api/works/${id}`, { ...patch, expectedUpdatedAt: current.updatedAt });
        setPosts((list) => list.map((p) => (p.id === id ? { ...p, updatedAt: res.work.updatedAt } : p)));
      } catch {
        showToast("Couldn't save that change. Try again.");
        load();
      }
    };
    const next = (chains.current.get(id) ?? Promise.resolve()).then(run, run);
    chains.current.set(id, next);
    return next as Promise<void>;
  }

  async function remove(target: StudioPost) {
    const index = latest.current.findIndex((p) => p.id === target.id);
    try {
      await chains.current.get(target.id);
      await api("DELETE", `/api/works/${target.id}`);
    } catch {
      showToast("Couldn't delete that post. Try again.");
      return;
    }
    setPosts((list) => list.filter((p) => p.id !== target.id));
    showToast("Post deleted", {
      label: "Undo",
      run: () =>
        api("POST", `/api/works/${target.id}/restore`)
          .then(() =>
            setPosts((list) => {
              const copy = [...list];
              copy.splice(Math.min(index, copy.length), 0, target);
              return copy;
            }),
          )
          .catch(() => showToast("Couldn't bring it back. Try again.")),
    });
  }

  return { posts, state, posting, progress, reload: load, post, save, remove };
}
