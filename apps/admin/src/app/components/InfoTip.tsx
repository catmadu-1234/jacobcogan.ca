import { useId, useState, type KeyboardEvent } from "react";
import { Info } from "lucide-react";
import styles from "./InfoTip.module.css";

interface Props {
  /** The name of the thing being explained, used to label the button. */
  label: string;
  text: string;
}

/**
 * A small "i" that shows an explanation floating over the page while it is hovered or focused, without moving
 * anything. Tapping it keeps the note open (touch screens have no hover); Escape or tapping again closes it.
 */
export function InfoTip({ label, text }: Props) {
  const id = useId();
  const [hover, setHover] = useState(false);
  const [focus, setFocus] = useState(false);
  const [pinned, setPinned] = useState(false);
  const open = hover || focus || pinned;

  function onKeyDown(e: KeyboardEvent<HTMLButtonElement>) {
    if (e.key === "Escape") {
      setPinned(false);
      setHover(false);
      setFocus(false);
    }
  }

  return (
    <span className={styles.tip} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
      <button
        type="button"
        className={styles.button}
        aria-label={`About ${label}`}
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setPinned((p) => !p)}
        onFocus={() => setFocus(true)}
        onBlur={() => {
          setFocus(false);
          setPinned(false);
        }}
        onKeyDown={onKeyDown}
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
