import { dismissToast, toastStore } from "../lib/toast";
import { useStore } from "../lib/store";
import styles from "./Toast.module.css";

export function Toast() {
  const toast = useStore(toastStore);
  if (!toast) return null;
  const action = toast.action;
  return (
    <div className={styles.toast} role="status" aria-live="polite">
      <span>{toast.message}</span>
      {action ? (
        <button
          type="button"
          className={styles.action}
          onClick={() => {
            dismissToast(toast.id);
            action.run();
          }}
        >
          {action.label}
        </button>
      ) : null}
    </div>
  );
}
