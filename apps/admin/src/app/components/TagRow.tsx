import { useRef, useState, type KeyboardEvent } from "react";
import { Trash2 } from "lucide-react";
import type { Tag } from "@senka/core/types";
import { Button } from "./Button";
import styles from "./TagRow.module.css";

interface Props {
  tag: Tag;
  /** The other tag that renaming to `name` would merge into, if any. */
  findMergeTarget: (tag: Tag, name: string) => Tag | null;
  onRename: (tag: Tag, name: string) => void;
  onDelete: (tag: Tag) => void;
}

export function TagRow({ tag, findMergeTarget, onRename, onDelete }: Props) {
  const [mode, setMode] = useState<"view" | "edit" | "merge">("view");
  const [draft, setDraft] = useState(tag.name);
  const [target, setTarget] = useState<Tag | null>(null);
  const finished = useRef(false);
  const count = tag.count ?? 0;

  function start() {
    finished.current = false;
    setDraft(tag.name);
    setMode("edit");
  }

  function submit() {
    finished.current = true;
    const name = draft.trim();
    if (!name || name === tag.name) return setMode("view");
    const other = findMergeTarget(tag, name);
    if (other) {
      setTarget(other);
      return setMode("merge");
    }
    onRename(tag, name);
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
          Merge ‘{tag.name}’ into ‘{target.name}’? Works tagged {tag.name} will be tagged {target.name}.
        </p>
        <div className={styles.actions}>
          <Button
            onClick={() => {
              onRename(tag, draft.trim());
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
          aria-label={`New name for ${tag.name}`}
          value={draft}
          maxLength={40}
          autoFocus
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          onBlur={() => !finished.current && submit()}
        />
      ) : (
        <button type="button" className={styles.name} aria-label={`Rename ${tag.name}`} onClick={start}>
          {tag.name}
        </button>
      )}
      <span className={styles.count}>{count === 1 ? "1 work" : `${count} works`}</span>
      <button type="button" className={styles.delete} aria-label={`Delete ${tag.name}`} onClick={() => onDelete(tag)}>
        <Trash2 size={18} aria-hidden="true" />
      </button>
    </li>
  );
}
