import type { SaveState } from "../lib/autosave";
import styles from "./SaveIndicator.module.css";

interface Props {
  state: SaveState;
  onRetry: () => void;
  /** Plain-language explanation of a failed save. */
  reason?: string;
}

export function SaveIndicator({ state, onRetry, reason }: Props) {
  return (
    <span className={`${styles.indicator} ${state === "error" || state === "conflict" ? styles.problem : ""}`} role="status" aria-live="polite">
      {state === "saved" ? "Saved" : null}
      {state === "saving" ? "Saving…" : null}
      {state === "offline" ? "No connection. We'll retry when you're back." : null}
      {state === "conflict" ? "Out of date" : null}
      {state === "error" ? (
        <>
          Couldn't save{reason ? `: ${reason}` : ""} ·{" "}
          <button type="button" className={styles.retry} onClick={onRetry}>
            Retry
          </button>
        </>
      ) : null}
    </span>
  );
}
