import { Tag as TagIcon } from "lucide-react";
import { useTags } from "../lib/useTags";
import { EmptyState } from "../components/EmptyState";
import { TagRow } from "../components/TagRow";
import styles from "./Tags.module.css";

export function Tags() {
  const { tags, status, mergeTarget, rename, remove, reload } = useTags();

  return (
    <div className={styles.page}>
      <header className={styles.heading}>
        <h1 className={styles.title}>Tags</h1>
        <p className={styles.lede}>Rename a tag by tapping it. Giving two tags the same name merges them.</p>
      </header>

      {status === "error" ? (
        <EmptyState icon={<TagIcon size={28} />} text="We couldn't load your tags." actionLabel="Try again" onAction={reload} />
      ) : status === "loading" ? (
        <p aria-busy="true" className={styles.lede}>
          Loading…
        </p>
      ) : tags.length === 0 ? (
        <EmptyState icon={<TagIcon size={28} />} text="No tags yet. Tags you add to works show up here." />
      ) : (
        <ul className={styles.list}>
          {tags.map((t) => (
            <TagRow key={t.id} tag={t} findMergeTarget={mergeTarget} onRename={(tag, name) => void rename(tag, name)} onDelete={remove} />
          ))}
        </ul>
      )}
    </div>
  );
}
