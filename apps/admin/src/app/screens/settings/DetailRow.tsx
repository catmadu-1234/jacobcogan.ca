import { useEffect, useState, type KeyboardEvent, type PointerEvent } from "react";
import { Archive, GripVertical } from "lucide-react";
import type { FieldDef } from "@senka/core/types";
import type { DetailChange } from "../../lib/useFields";
import { Switch } from "../../components/Switch";
import styles from "./DetailRow.module.css";

interface Props {
  def: FieldDef;
  dragging: boolean;
  onChange: (id: number, change: DetailChange) => void;
  onHandlePointerDown: (e: PointerEvent<HTMLButtonElement>) => void;
  onHandleKeyDown: (e: KeyboardEvent<HTMLButtonElement>) => void;
}

export function DetailRow({ def, dragging, onChange, onHandlePointerDown, onHandleKeyDown }: Props) {
  const [draft, setDraft] = useState(def.label);
  useEffect(() => setDraft(def.label), [def.label]);

  function commitName() {
    const name = draft.trim();
    if (!name) return setDraft(def.label);
    if (name !== def.label) onChange(def.id, { label: name });
  }

  return (
    <li className={`${styles.row} ${dragging ? styles.dragging : ""}`} data-reorder-id={def.id}>
      <button
        type="button"
        className={styles.handle}
        aria-label={`Move ${def.label}. Use the arrow keys, or drag.`}
        onPointerDown={onHandlePointerDown}
        onKeyDown={onHandleKeyDown}
      >
        <GripVertical size={18} aria-hidden="true" />
      </button>
      <input
        className={styles.name}
        aria-label={`Name of ${def.label}`}
        value={draft}
        maxLength={60}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commitName}
        onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
      />
      <select
        className={styles.type}
        aria-label={`Type of ${def.label}`}
        value={def.type}
        onChange={(e) => onChange(def.id, { type: e.target.value as FieldDef["type"] })}
      >
        <option value="text">Short text</option>
        <option value="longtext">Long text</option>
        <option value="url">Link</option>
      </select>
      <Switch label="Required" checked={def.required} onChange={(required) => onChange(def.id, { required })} />
      <button type="button" className={styles.archive} aria-label={`Archive ${def.label}`} onClick={() => onChange(def.id, { archived: true })}>
        <Archive size={18} aria-hidden="true" />
      </button>
    </li>
  );
}
