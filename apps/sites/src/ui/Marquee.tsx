import styles from "./Marquee.module.css";

interface Props {
  items: string[];
}

/** A slow strip of words. It repeats once so the loop has no seam, and is decoration only. */
export function Marquee({ items }: Props) {
  if (items.length === 0) return null;
  return (
    <div className={styles.marquee} aria-hidden="true">
      <div className={styles.track}>
        <div className={styles.group}>
          {items.map((item) => (
            <span key={item} className={styles.item}>
              {item}
            </span>
          ))}
        </div>
        <div className={styles.group}>
          {items.map((item) => (
            <span key={item} className={styles.item}>
              {item}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
