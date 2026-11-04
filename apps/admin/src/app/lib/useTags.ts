import { useCallback, useEffect, useRef, useState } from "react";
import type { Tag } from "@senka/core/types";
import { tagSlug } from "@senka/core/slug";
import { api } from "./api";
import { showToast } from "./toast";

const UNDO_MS = 5_000;

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

  // Deleting is undoable for 5 seconds; the server only hears about it when that window closes (or on leaving).
  const waiting = useRef(new Map<number, { timer: ReturnType<typeof setTimeout>; commit: () => void }>());
  useEffect(() => {
    const map = waiting.current;
    return () => {
      for (const { timer, commit } of map.values()) {
        clearTimeout(timer);
        commit();
      }
    };
  }, []);

  function remove(tag: Tag): void {
    const index = tags.findIndex((t) => t.id === tag.id);
    setTags((list) => list.filter((t) => t.id !== tag.id));
    const commit = () => {
      waiting.current.delete(tag.id);
      api("DELETE", `/api/tags/${tag.id}`).catch(() => {
        showToast("Couldn't delete that tag. Reload and try again.");
      });
    };
    waiting.current.set(tag.id, { timer: setTimeout(commit, UNDO_MS), commit });
    showToast("Tag deleted", {
      label: "Undo",
      run: () => {
        const entry = waiting.current.get(tag.id);
        if (!entry) return;
        clearTimeout(entry.timer);
        waiting.current.delete(tag.id);
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
