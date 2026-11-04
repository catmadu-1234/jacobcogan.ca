const UNDO_MS = 5_000;

type Send = (keepalive: boolean) => Promise<unknown>;

/**
 * Deletes that wait out an "Undo" window before they are sent. If the page goes away first (tab closed, reload,
 * app switched away) the waiting deletes are sent immediately with `keepalive`, which lets the browser finish
 * them after the page is gone. Otherwise a removed file would quietly stay on the public site.
 */
export function createPendingDeletes(delayMs = UNDO_MS) {
  const waiting = new Map<string | number, { timer: ReturnType<typeof setTimeout>; send: Send }>();

  function fire(key: string | number, keepalive: boolean): void {
    const entry = waiting.get(key);
    if (!entry) return;
    clearTimeout(entry.timer);
    waiting.delete(key);
    // One failing delete must not stop the others; callers report their own failures inside `send`.
    void entry.send(keepalive).catch(() => {});
  }

  const commitAll = (keepalive: boolean) => [...waiting.keys()].forEach((key) => fire(key, keepalive));

  return {
    schedule(key: string | number, send: Send): void {
      waiting.get(key) && clearTimeout(waiting.get(key)!.timer);
      waiting.set(key, { timer: setTimeout(() => fire(key, false), delayMs), send });
    },
    /** Cancels a waiting delete (the user pressed Undo). Returns false if it had already been sent. */
    cancel(key: string | number): boolean {
      const entry = waiting.get(key);
      if (!entry) return false;
      clearTimeout(entry.timer);
      waiting.delete(key);
      return true;
    },
    commitAll,
    hasPending: () => waiting.size > 0,
    /** Starts watching for the page going away. Returns a function that stops watching. */
    install(): () => void {
      const onHide = () => commitAll(true);
      const onVisibility = () => document.visibilityState === "hidden" && commitAll(true);
      window.addEventListener("pagehide", onHide);
      document.addEventListener("visibilitychange", onVisibility);
      return () => {
        window.removeEventListener("pagehide", onHide);
        document.removeEventListener("visibilitychange", onVisibility);
      };
    },
  };
}
