import styles from "./Lightbox.module.css";

/** The full-size viewer. A small script on the work page opens it; without script the image links open directly. */
export function Lightbox() {
  return (
    <dialog className={styles.dialog} data-lightbox aria-label="Full size image">
      <button type="button" className={styles.close} data-close aria-label="Close">
        ×
      </button>
      <img className={styles.img} alt="" />
    </dialog>
  );
}
