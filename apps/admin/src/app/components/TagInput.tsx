import { useId, useState, type KeyboardEvent } from "react";
import { X } from "lucide-react";
import { MAX_TAGS, addTag, suggest } from "../lib/tags";
import styles from "./TagInput.module.css";

interface Props {
  tags: string[];
  suggestions: string[];
  onChange: (tags: string[]) => void;
}

export function TagInput({ tags, suggestions, onChange }: Props) {
  const id = useId();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(-1);
  const [open, setOpen] = useState(false);

  const { matches, canCreate } = suggest(query, suggestions, tags);
  const options = canCreate ? [...matches, query.trim()] : matches;
  const full = tags.length >= MAX_TAGS;

  function commit(name: string) {
    onChange(addTag(tags, name));
    setQuery("");
    setActive(-1);
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      setOpen(true);
      const step = e.key === "ArrowDown" ? 1 : -1;
      setActive((a) => (options.length ? (a + step + options.length) % options.length : -1));
    } else if (e.key === "Enter" || e.key === ",") {
      if (!query.trim()) return;
      e.preventDefault();
      commit(active >= 0 && options[active] ? options[active]! : query);
    } else if (e.key === "Escape") {
      setOpen(false);
    } else if (e.key === "Backspace" && query === "" && tags.length) {
      onChange(tags.slice(0, -1));
    }
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.box}>
        {tags.map((t) => (
          <span key={t} className={styles.chip}>
            {t}
            <button type="button" className={styles.remove} aria-label={`Remove tag ${t}`} onClick={() => onChange(tags.filter((x) => x !== t))}>
              <X size={14} aria-hidden="true" />
            </button>
          </span>
        ))}
        <input
          className={styles.input}
          role="combobox"
          aria-label="Add a tag"
          aria-expanded={open && options.length > 0}
          aria-controls={`${id}-list`}
          aria-activedescendant={active >= 0 ? `${id}-opt-${active}` : undefined}
          autoComplete="off"
          disabled={full}
          placeholder={full ? "That's the maximum of 20 tags" : tags.length ? "" : "Add a tag, e.g. Painting"}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(-1);
            setOpen(true);
          }}
          onKeyDown={onKeyDown}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
        />
      </div>
      {open && options.length > 0 ? (
        <ul id={`${id}-list`} role="listbox" className={styles.list}>
          {options.map((o, i) => (
            <li
              key={o}
              id={`${id}-opt-${i}`}
              role="option"
              aria-selected={i === active}
              className={`${styles.option} ${i === active ? styles.active : ""}`}
              onMouseDown={(e) => {
                e.preventDefault();
                commit(o);
              }}
            >
              {canCreate && i === options.length - 1 ? `Create "${o}"` : o}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
