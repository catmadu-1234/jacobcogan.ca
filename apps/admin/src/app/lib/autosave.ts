import { useEffect, useMemo, useRef } from "react";
import { ApiError } from "./api";
import { createStore, useStore, type Store } from "./store";

export type SaveState = "saved" | "saving" | "error" | "offline" | "conflict";

function classify(err: unknown): SaveState {
  if (err instanceof ApiError && err.status === 409) return "conflict";
  if (err instanceof TypeError || (typeof navigator !== "undefined" && navigator.onLine === false)) return "offline";
  return "error";
}

/**
 * Debounced saving of partial edits. Patches queued close together are merged into one request; edits made
 * while a save is running go out afterwards; a failed patch is kept and merged with newer edits for the retry.
 * After a conflict (409) nothing more is sent: the page has to be reloaded to pick up the other change.
 */
export function createAutosave<T extends object>(
  save: (patch: Partial<T>) => Promise<void>,
  delayMs = 800,
  /** How two patches combine; the default is a shallow merge where the newer value wins. */
  merge: (older: Partial<T>, newer: Partial<T>) => Partial<T> = (a, b) => ({ ...a, ...b }),
) {
  const state: Store<SaveState> = createStore<SaveState>("saved");
  let pending: Partial<T> | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let inFlight: Promise<void> | null = null;

  const onOnline = () => {
    if (state.get() === "offline") void run();
  };

  async function run(): Promise<void> {
    clearTimeout(timer);
    if (inFlight) {
      await inFlight;
      return;
    }
    if (!pending || state.get() === "conflict") return;
    const patch = pending;
    pending = null;
    state.set("saving");
    inFlight = (async () => {
      try {
        await save(patch);
      } catch (err) {
        pending = pending ? merge(patch, pending) : patch;
        const next = classify(err);
        state.set(next);
        if (next === "offline") window.addEventListener("online", onOnline, { once: true });
      }
    })();
    await inFlight;
    inFlight = null;
    if (state.get() !== "saving") return;
    if (pending) await run();
    else state.set("saved");
  }

  return {
    state,
    queue(patch: Partial<T>): void {
      pending = pending ? merge(pending, patch) : patch;
      if (state.get() === "conflict") return;
      state.set("saving");
      clearTimeout(timer);
      timer = setTimeout(() => void run(), delayMs);
    },
    flush: run,
    /** Send whatever is waiting right now, instead of after the delay. */
    retry(): void {
      void run();
    },
    hasUnsaved: () => pending !== null || inFlight !== null,
  };
}

/** One autosave per mounted screen; unsent edits are flushed when the screen goes away. */
export function useAutosave<T extends object>(
  save: (patch: Partial<T>) => Promise<void>,
  delayMs?: number,
  merge?: (older: Partial<T>, newer: Partial<T>) => Partial<T>,
) {
  const saveRef = useRef(save);
  saveRef.current = save;
  const autosave = useMemo(() => createAutosave<T>((p) => saveRef.current(p), delayMs, merge), [delayMs, merge]);
  useEffect(() => () => void autosave.flush(), [autosave]);
  return { autosave, state: useStore(autosave.state) };
}
