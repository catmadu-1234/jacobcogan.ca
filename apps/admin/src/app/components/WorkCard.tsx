import type { KeyboardEvent, PointerEvent } from "react";
import { GripVertical, Images } from "lucide-react";
import { thumbUrl } from "../lib/media";
import type { WorkSummary } from "../lib/useWorks";
import styles from "./WorkCard.module.css";

interface Props {
  work: WorkSummary;
  reordering: boolean;
  dragging: boolean;
  onHandlePointerDown: (e: PointerEvent<HTMLButtonElement>) => void;
  onHandlePointerMove: (e: PointerEvent<HTMLButtonElement>) => void;
  onHandlePointerEnd: () => void;
  onHandleKeyDown: (e: KeyboardEvent<HTMLButtonElement>) => void;
}

export function WorkCard({
  work, reordering, dragging, onHandlePointerDown, onHandlePointerMove, onHandlePointerEnd, onHandleKeyDown,
}: Props) {
  const title = work.title.trim() || "Untitled";
  const src = work.cover ? thumbUrl(work.cover) : null;
  const thumb = (
    <div className={styles.thumb} style={work.cover?.color ? { backgroundColor: work.cover.color } : undefined}>
      {src ? <img src={src} alt="" loading="lazy" decoding="async" /> : <Images size={28} aria-hidden="true" />}
      {work.visible ? null : <span className={styles.pill}>Hidden</span>}
    </div>
  );
  const caption = <span className={styles.title}>{title}</span>;

  if (!reordering) {
    return (
      <a className={styles.card} href={`#/works/${work.id}`} data-work-id={work.id}>
        {thumb}
        {caption}
      </a>
    );
  }
  return (
    <div className={`${styles.card} ${dragging ? styles.dragging : ""}`} data-work-id={work.id}>
      {thumb}
      {caption}
      <button
        type="button"
        className={styles.handle}
        aria-label={`Move ${title}. Use the arrow keys, or drag.`}
        onPointerDown={onHandlePointerDown}
        onPointerMove={onHandlePointerMove}
        onPointerUp={onHandlePointerEnd}
        onPointerCancel={onHandlePointerEnd}
        onKeyDown={onHandleKeyDown}
      >
        <GripVertical size={20} aria-hidden="true" />
      </button>
    </div>
  );
}
