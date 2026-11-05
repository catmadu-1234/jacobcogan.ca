import { useCallback, useEffect, useState } from "react";
import type { Media, Work } from "@senka/core/types";
import { api } from "./api";

export type WorkSummary = Work & { cover: Media | null };
export type LoadState = "loading" | "ready" | "error";

/** Loads the works grid (search). Search is debounced; stale replies are ignored. */
export function useWorks() {
  const [query, setQuery] = useState("");
  const [works, setWorks] = useState<WorkSummary[]>([]);
  const [state, setState] = useState<LoadState>("loading");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setState("loading");
    const timer = setTimeout(
      () => {
        const params = new URLSearchParams();
        if (query.trim()) params.set("q", query.trim());
        api<WorkSummary[]>("GET", `/api/works?${params}`)
          .then((list) => {
            if (cancelled) return;
            setWorks(list);
            setState("ready");
          })
          .catch(() => !cancelled && setState("error"));
      },
      attempt === 0 && query === "" ? 0 : 250,
    );
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, attempt]);

  const reload = useCallback(() => setAttempt((n) => n + 1), []);
  return { query, setQuery, works, setWorks, state, reload };
}
