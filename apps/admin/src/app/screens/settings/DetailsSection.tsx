import { useState } from "react";
import { Plus } from "lucide-react";
import type { FieldDef } from "@senka/core/types";
import { useDragReorder } from "../../lib/useDragReorder";
import { useFields } from "../../lib/useFields";
import { Button } from "../../components/Button";
import { DetailRow } from "./DetailRow";
import styles from "./DetailsSection.module.css";

export function DetailsSection() {
  const fields = useFields();
  const reorder = useDragReorder(fields.active, (ids) => void fields.reorder(ids));
  const [adding, setAdding] = useState(false);
  const [label, setLabel] = useState("");
  const [type, setType] = useState<FieldDef["type"]>("text");
  const [required, setRequired] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    const ok = await fields.add({ label: label.trim(), type, required });
    setBusy(false);
    if (ok) {
      setAdding(false);
      setLabel("");
      setType("text");
      setRequired(false);
    }
  }

  return (
    <section className={styles.section} aria-labelledby="details-heading">
      <h2 id="details-heading" className={styles.heading}>
        Details
      </h2>
      <p className={styles.lede}>Things you want to say about every work, like its medium or size.</p>

      {fields.status === "error" ? (
        <p className={styles.lede}>
          We couldn't load your details. <button type="button" className={styles.link} onClick={() => void fields.reload()}>Try again</button>
        </p>
      ) : (
        <>
          {fields.active.length === 0 && fields.status === "ready" ? (
            <p className={styles.lede}>No details yet. Try Medium, Dimensions or Year.</p>
          ) : null}
          <ul className={styles.list}>
            {reorder.shown.map((def) => {
              const h = reorder.handlers(def.id);
              return (
                <DetailRow
                  key={def.id}
                  def={def}
                  dragging={reorder.dragId === def.id}
                  onChange={(id, change) => void fields.update(id, change)}
                  onHandlePointerDown={h.onPointerDown}
                  onHandleKeyDown={h.onKeyDown}
                />
              );
            })}
          </ul>

          {adding ? (
            <form
              className={styles.add}
              onSubmit={(e) => {
                e.preventDefault();
                if (label.trim()) void submit();
              }}
            >
              <input
                className={styles.input}
                aria-label="New detail name"
                placeholder="e.g. Medium"
                value={label}
                maxLength={60}
                autoFocus
                onChange={(e) => setLabel(e.target.value)}
              />
              <select className={styles.input} aria-label="New detail type" value={type} onChange={(e) => setType(e.target.value as FieldDef["type"])}>
                <option value="text">Short text</option>
                <option value="longtext">Long text</option>
                <option value="url">Link</option>
              </select>
              <label className={styles.check}>
                <input type="checkbox" checked={required} onChange={(e) => setRequired(e.target.checked)} /> Required
              </label>
              <Button type="submit" busy={busy} disabled={!label.trim()}>
                Add
              </Button>
              <Button variant="ghost" onClick={() => setAdding(false)}>
                Cancel
              </Button>
            </form>
          ) : (
            <Button variant="secondary" className={styles.addButton} onClick={() => setAdding(true)}>
              <Plus size={18} aria-hidden="true" /> Add a detail
            </Button>
          )}

          {fields.archived.length > 0 ? (
            <details className={styles.archived}>
              <summary>Archived details ({fields.archived.length})</summary>
              <p className={styles.lede}>Hidden from your editor and your site. What you wrote is kept.</p>
              <ul className={styles.list}>
                {fields.archived.map((d) => (
                  <li key={d.id} className={styles.archivedRow}>
                    <span>{d.label}</span>
                    <Button variant="secondary" aria-label={`Restore ${d.label}`} onClick={() => void fields.update(d.id, { archived: false })}>
                      Restore
                    </Button>
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
        </>
      )}
    </section>
  );
}
