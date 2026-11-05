import { useId, useState } from "react";
import { Info } from "lucide-react";
import styles from "./InfoTip.module.css";

interface Props {
  /** The name of the thing being explained, used to label the button. */
  label: string;
  text: string;
}

/** A small "i" that opens a plain-language explanation beneath it. */
export function InfoTip({ label, text }: Props) {
  const id = useId();
  const [open, setOpen] = useState(false);
  return (
    <span className={styles.tip}>
      <button
        type="button"
        className={styles.button}
        aria-label={`About ${label}`}
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((o) => !o)}
      >
        <Info size={16} aria-hidden="true" />
      </button>
      {open ? (
        <p id={id} className={styles.text} role="note">
          {text}
        </p>
      ) : null}
    </span>
  );
}
