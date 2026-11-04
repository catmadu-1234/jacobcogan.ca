import { useState } from "react";
import type { ThemeConfig } from "@senka/core/types";
import type { SitePatch } from "../../lib/sitePatch";
import styles from "./LookSection.module.css";

const HEX = /^#[0-9a-fA-F]{6}$/;

interface Props {
  theme: ThemeConfig;
  onPatch: (patch: SitePatch) => void;
}

export function LookSection({ theme, onPatch }: Props) {
  const [preset, setPreset] = useState(theme.preset);
  const [accentText, setAccentText] = useState(theme.accent);
  const valid = HEX.test(accentText);
  const accent = valid ? accentText : theme.accent;

  function changeAccent(value: string) {
    setAccentText(value);
    if (HEX.test(value)) onPatch({ theme: { accent: value } });
  }

  return (
    <section className={styles.section} aria-labelledby="look-heading">
      <h2 id="look-heading" className={styles.heading}>
        Look
      </h2>

      <fieldset className={styles.styles}>
        <legend className={styles.legend}>Style</legend>
        <label className={`${styles.card} ${preset === "grotesk" ? styles.selected : ""}`}>
          <input
            type="radio"
            name="style"
            checked={preset === "grotesk"}
            onChange={() => {
              setPreset("grotesk");
              onPatch({ theme: { preset: "grotesk" } });
            }}
          />
          <span className={styles.sampleSans}>Aa</span>
          <span className={styles.cardTitle}>Grotesk</span>
          <span className={styles.cardText}>Clean, modern sans-serif.</span>
        </label>
        <label className={`${styles.card} ${preset === "serif-title" ? styles.selected : ""}`}>
          <input
            type="radio"
            name="style"
            checked={preset === "serif-title"}
            onChange={() => {
              setPreset("serif-title");
              onPatch({ theme: { preset: "serif-title" } });
            }}
          />
          <span className={styles.sampleSerif}>Aa</span>
          <span className={styles.cardTitle}>Serif titles</span>
          <span className={styles.cardText}>Elegant italic serif headings.</span>
        </label>
      </fieldset>

      <div className={styles.accent}>
        <label htmlFor="accent-hex" className={styles.accentLabel}>
          Accent colour
        </label>
        <div className={styles.accentRow}>
          <input
            type="color"
            className={styles.swatch}
            aria-label="Accent colour"
            value={accent.toLowerCase()}
            onChange={(e) => changeAccent(e.target.value)}
          />
          <input
            id="accent-hex"
            className={`${styles.hex} ${valid ? "" : styles.invalid}`}
            aria-label="Accent colour (hex)"
            aria-invalid={valid ? undefined : true}
            value={accentText}
            maxLength={7}
            onChange={(e) => changeAccent(e.target.value)}
          />
          <span className={styles.preview} style={{ ["--accent" as string]: accent }}>
            Hover colour
          </span>
        </div>
        {valid ? <p className={styles.help}>Used for links and highlights on your site.</p> : <p className={styles.error}>Use a colour like #7A3E2E.</p>}
      </div>
    </section>
  );
}
