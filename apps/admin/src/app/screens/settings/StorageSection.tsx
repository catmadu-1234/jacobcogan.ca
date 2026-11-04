import { STORAGE_LIMIT_BYTES, STORAGE_LIMIT_LABEL, formatBytes } from "../../lib/format";
import styles from "./StorageSection.module.css";

interface Props {
  usedBytes: number;
}

export function StorageSection({ usedBytes }: Props) {
  const share = Math.min(1, usedBytes / STORAGE_LIMIT_BYTES);
  const warn = share >= 0.8;
  return (
    <section className={styles.section} aria-labelledby="storage-heading">
      <h2 id="storage-heading" className={styles.heading}>
        Storage
      </h2>
      <div
        className={styles.meter}
        role="meter"
        aria-label="Storage used"
        aria-valuemin={0}
        aria-valuemax={STORAGE_LIMIT_BYTES}
        aria-valuenow={usedBytes}
        data-warn={warn}
      >
        <div className={styles.fill} style={{ width: `${Math.round(share * 100)}%` }} />
      </div>
      <p className={styles.text}>
        {formatBytes(usedBytes)} of {STORAGE_LIMIT_LABEL} used
      </p>
      {warn ? <p className={styles.warn}>You're running low on space. Removing unused videos frees up the most.</p> : null}
    </section>
  );
}
