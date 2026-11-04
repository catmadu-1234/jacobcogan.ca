import { useState } from "react";
import { Plus, X } from "lucide-react";
import type { SiteLink } from "@senka/core/types";
import { cleanLinks, type LinkRow } from "../../lib/links";
import type { SitePatch } from "../../lib/sitePatch";
import { Button } from "../../components/Button";
import { TextField } from "../../components/TextField";
import styles from "./AboutSection.module.css";

const MAX_LINKS = 10;

interface Props {
  name: string;
  about: string;
  links: SiteLink[];
  onPatch: (patch: SitePatch) => void;
}

export function AboutSection({ name, about, links, onPatch }: Props) {
  const [nameText, setNameText] = useState(name);
  const [bio, setBio] = useState(about);
  const [rows, setRows] = useState<LinkRow[]>(links.map((l) => ({ ...l })));
  const [errors, setErrors] = useState<Record<number, string>>({});

  function changeRows(next: LinkRow[]) {
    setRows(next);
    const result = cleanLinks(next);
    setErrors(result.ok ? {} : result.errors);
    if (result.ok) onPatch({ links: result.links });
  }

  return (
    <section className={styles.section} aria-labelledby="about-heading">
      <h2 id="about-heading" className={styles.heading}>
        About
      </h2>
      <TextField
        label="Your name"
        value={nameText}
        maxLength={100}
        onChange={(v) => {
          setNameText(v);
          if (v.trim()) onPatch({ name: v });
        }}
      />
      <TextField
        label="Bio"
        multiline
        value={bio}
        maxLength={5000}
        help="Shown on your About page."
        onChange={(v) => {
          setBio(v);
          onPatch({ about: v });
        }}
      />

      <div className={styles.links}>
        <p className={styles.linksTitle}>Links</p>
        {rows.map((row, i) => (
          <div key={i} className={styles.row}>
            <input
              className={styles.input}
              aria-label={`Link name ${i + 1}`}
              placeholder="Instagram"
              value={row.label}
              maxLength={40}
              onChange={(e) => changeRows(rows.map((r, j) => (j === i ? { ...r, label: e.target.value } : r)))}
            />
            <input
              className={`${styles.input} ${styles.url}`}
              aria-label={`Link web address ${i + 1}`}
              type="url"
              inputMode="url"
              placeholder="https://"
              value={row.url}
              onChange={(e) => changeRows(rows.map((r, j) => (j === i ? { ...r, url: e.target.value } : r)))}
            />
            <button type="button" className={styles.remove} aria-label={`Remove link ${i + 1}`} onClick={() => changeRows(rows.filter((_, j) => j !== i))}>
              <X size={18} aria-hidden="true" />
            </button>
            {errors[i] ? <p className={styles.error}>{errors[i]}</p> : null}
          </div>
        ))}
        {rows.length < MAX_LINKS ? (
          <Button variant="secondary" onClick={() => setRows([...rows, { label: "", url: "" }])}>
            <Plus size={18} aria-hidden="true" /> Add a link
          </Button>
        ) : null}
      </div>
    </section>
  );
}
