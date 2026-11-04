import styles from "./Switch.module.css";

interface Props {
  label: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
}

export function Switch({ label, checked, onChange, disabled }: Props) {
  return (
    <label className={styles.row}>
      <span className={styles.label}>{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        className={`${styles.track} ${checked ? styles.on : ""}`}
        onClick={() => onChange(!checked)}
      >
        <span className={styles.thumb} />
      </button>
    </label>
  );
}
