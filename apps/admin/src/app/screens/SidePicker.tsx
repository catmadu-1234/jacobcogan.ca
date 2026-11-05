import { useEffect, useState } from "react";
import { api } from "../lib/api";
import styles from "./SidePicker.module.css";

interface Side {
  slug: string;
  name: string;
}

/** Shown while the admin has no login: pick whose site you are working on. Remembered on this device. */
export function SidePicker() {
  const [sides, setSides] = useState<Side[] | null>(null);
  useEffect(() => {
    api<Side[]>("GET", "/api/sides")
      .then(setSides)
      .catch(() => setSides([]));
  }, []);

  return (
    <main className={styles.page}>
      <p className={styles.brand}>senka</p>
      <h1 className={styles.title}>Whose side?</h1>
      <p className={styles.lede}>Pick the site you want to work on. This device will remember it.</p>
      <ul className={styles.sides}>
        {(sides ?? []).map((s) => (
          <li key={s.slug}>
            <a className={styles.side} href={`/api/side/${encodeURIComponent(s.slug)}`}>
              {s.name}
            </a>
          </li>
        ))}
      </ul>
      {sides !== null && sides.length === 0 ? <p className={styles.lede}>Nothing to pick yet. Try reloading.</p> : null}
    </main>
  );
}
