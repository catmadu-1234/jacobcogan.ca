import { useCallback, useEffect, useRef, useState } from "react";
import type { Tag } from "@senka/core/types";
import { tagSlug } from "@senka/core/slug";
import { api, sendDelete } from "./api";
import { createPendingDeletes } from "./pendingDeletes";
import { showToast } from "./toast";

/** The site's tags with rename (merge-aware) and an undoable delete. */
export function useTags() {
  const [tags, setTags] = useState<Tag[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  const load = useCallback(async () => {
    try {
      setTags(await api<Tag[]>("GET", "/api/tags"));
      setStatus("ready");
    } catch {
      setStatus("error");
    }
  }, []);
  useEffect(() => void load(), [load]);

  /** The other tag a rename would merge into, if any (the server matches tags by slug). */
  function mergeTarget(tag: Tag, name: string): Tag | null {
    const slug = tagSlug(name);
    return tags.find((t) => t.id !== tag.id && t.slug === slug) ?? null;
  }

  async function rename(tag: Tag, name: string): Promise<void> {
    try {
      await api("PATCH", `/api/tags/${tag.id}`, { name });
    } catch {
      showToast("Couldn't rename that tag. Try again.");
    }
    await load();
  }

  // Deleting is undoable for 5 seconds; the server hears about it when that window closes, or at once if the page
  // goes away first.
  const pending = useRef(createPendingDeletes());
  useEffect(() => {
    const deletes = pending.current;
    const stop = deletes.install();
    return () => {
      stop();
      deletes.commitAll(false);
    };
  }, []);

  function remove(tag: Tag): void {
    const index = tags.findIndex((t) => t.id === tag.id);
    setTags((list) => list.filter((t) => t.id !== tag.id));
    pending.current.schedule(tag.id, (keepalive) =>
      sendDelete(`/api/tags/${tag.id}`, keepalive).catch(() => showToast("Couldn't delete that tag. Reload and try again.")),
    );
    showToast("Tag deleted", {
      label: "Undo",
      run: () => {
        if (!pending.current.cancel(tag.id)) return;
        setTags((list) => {
          const copy = [...list];
          copy.splice(Math.min(index, copy.length), 0, tag);
          return copy;
        });
      },
    });
  }

  return { tags, status, mergeTarget, rename, remove, reload: load };
}
