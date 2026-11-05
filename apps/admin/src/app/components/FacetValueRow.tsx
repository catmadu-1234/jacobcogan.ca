import { useRef, useState, type KeyboardEvent } from "react";
import type { FacetValue } from "@senka/core/types";
import { Button } from "./Button";
import styles from "./FacetValueRow.module.css";

interface Props {
  value: FacetValue;
  /** The other value of this facet that renaming to `name` would merge into, if any. */
  findMergeTarget: (value: FacetValue, name: string) => FacetValue | null;
  onRename: (value: FacetValue, name: string) => void;
}

/** One catalogue value with how many works use it. Tapping the name renames it everywhere. */
export function FacetValueRow({ value, findMergeTarget, onRename }: Props) {
  const [mode, setMode] = useState<"view" | "edit" | "merge">("view");
  const [draft, setDraft] = useState(value.name);
  const [target, setTarget] = useState<FacetValue | null>(null);
  const finished = useRef(false);
  const count = value.count ?? 0;

  function start() {
    finished.current = false;
    setDraft(value.name);
    setMode("edit");
  }

  function submit() {
    finished.current = true;
    const name = draft.trim();
    if (!name || name === value.name) return setMode("view");
    const other = findMergeTarget(value, name);
    if (other) {
      setTarget(other);
      return setMode("merge");
    }
    onRename(value, name);
    setMode("view");
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") submit();
    if (e.key === "Escape") {
      finished.current = true;
      setMode("view");
    }
  }

  if (mode === "merge" && target) {
    return (
      <li className={styles.row}>
        <p className={styles.confirm}>
          Merge ‘{value.name}’ into ‘{target.name}’? Works with {value.name} will have {target.name} instead.
        </p>
        <div className={styles.actions}>
          <Button
            onClick={() => {
              onRename(value, draft.trim());
              setMode("view");
            }}
          >
            Merge
          </Button>
          <Button variant="secondary" onClick={() => setMode("view")}>
            Cancel
          </Button>
        </div>
      </li>
    );
  }

  return (
    <li className={styles.row}>
      {mode === "edit" ? (
        <input
          className={styles.input}
          aria-label={`New name for ${value.name}`}
          value={draft}
          maxLength={40}
          autoFocus
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          onBlur={() => !finished.current && submit()}
        />
      ) : (
        <button type="button" className={styles.name} aria-label={`Rename ${value.name}`} onClick={start}>
          {value.name}
        </button>
      )}
      <span className={styles.count}>{count === 1 ? "1 work" : `${count} works`}</span>
    </li>
  );
}
