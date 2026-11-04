import type { SaveState } from "../lib/autosave";
import styles from "./SaveIndicator.module.css";

interface Props {
  state: SaveState;
  onRetry: () => void;
}

export function SaveIndicator({ state, onRetry }: Props) {
  return (
    <span className={`${styles.indicator} ${state === "error" || state === "conflict" ? styles.problem : ""}`} role="status" aria-live="polite">
      {state === "saved" ? "Saved" : null}
      {state === "saving" ? "Saving…" : null}
      {state === "offline" ? "Offline · will retry" : null}
      {state === "conflict" ? "Out of date" : null}
      {state === "error" ? (
        <>
          Couldn't save ·{" "}
          <button type="button" className={styles.retry} onClick={onRetry}>
            Retry
          </button>
        </>
      ) : null}
    </span>
  );
}
