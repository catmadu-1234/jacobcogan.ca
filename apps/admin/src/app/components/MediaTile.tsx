import { useState, type KeyboardEvent, type PointerEvent } from "react";
import { AlertCircle, Film, GripVertical, ImageIcon, MoreHorizontal } from "lucide-react";
import styles from "./MediaTile.module.css";

export type TileState = "ready" | "pending" | "preparing" | "uploading" | "processing" | "error";

interface Props {
  name: string;
  kind: "image" | "video";
  src: string | null;
  color: string | null;
  alt: string;
  state: TileState;
  progress?: number;
  error?: string;
  warning?: string;
  isCover?: boolean;
  editingAlt?: boolean;
  reorderId?: number;
  dragging?: boolean;
  onSetCover?: () => void;
  onEditAlt?: () => void;
  onSaveAlt?: (text: string) => void;
  onCancelAlt?: () => void;
  onRemove?: () => void;
  onRetry?: () => void;
  onHandlePointerDown?: (e: PointerEvent<HTMLButtonElement>) => void;
  onHandleKeyDown?: (e: KeyboardEvent<HTMLButtonElement>) => void;
}

const RING = 2 * Math.PI * 18;

export function MediaTile(p: Props) {
  const [menu, setMenu] = useState(false);
  const busy = p.state === "preparing" || p.state === "uploading" || p.state === "processing";
  const percent = Math.round((p.progress ?? 0) * 100);
  const act = (fn?: () => void) => () => {
    setMenu(false);
    fn?.();
  };

  return (
    <div className={`${styles.tile} ${p.dragging ? styles.dragging : ""}`} data-reorder-id={p.reorderId}>
      <div className={`${styles.thumb} ${p.state === "error" ? styles.failed : ""}`} style={p.color ? { backgroundColor: p.color } : undefined}>
        {p.src && p.kind === "image" ? <img src={p.src} alt={p.alt} loading="lazy" decoding="async" /> : null}
        {p.src && p.kind === "video" ? <img src={p.src} alt={p.alt} loading="lazy" decoding="async" /> : null}
        {!p.src ? (p.kind === "video" ? <Film size={28} aria-hidden="true" /> : <ImageIcon size={28} aria-hidden="true" />) : null}

        {p.isCover ? <span className={styles.badge}>Cover</span> : null}
        {p.kind === "video" ? <Film className={styles.kind} size={16} aria-label="Video" /> : null}

        {busy ? (
          <div className={styles.progress} role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100} aria-label={`Uploading ${p.name}`}>
            <svg viewBox="0 0 44 44" width="44" height="44" aria-hidden="true">
              <circle cx="22" cy="22" r="18" className={styles.ringBg} />
              <circle cx="22" cy="22" r="18" className={styles.ring} strokeDasharray={RING} strokeDashoffset={RING * (1 - (p.progress ?? 0))} />
            </svg>
            <span>{p.state === "processing" ? "…" : `${percent}%`}</span>
          </div>
        ) : null}

        {p.state === "error" ? (
          <div className={styles.errorLayer}>
            <AlertCircle size={20} aria-hidden="true" />
            <button type="button" className={styles.retry} onClick={p.onRetry}>
              Retry
            </button>
          </div>
        ) : null}
        {p.state === "pending" ? <div className={styles.errorLayer}>Unfinished upload</div> : null}

        {p.onRemove || p.onSetCover || p.onEditAlt ? (
          <div className={styles.menuWrap} onBlur={(e) => !e.currentTarget.contains(e.relatedTarget) && setMenu(false)}>
            <button type="button" className={styles.menuButton} aria-label={`More actions for ${p.name}`} aria-expanded={menu} onClick={() => setMenu((m) => !m)}>
              <MoreHorizontal size={18} aria-hidden="true" />
            </button>
            {menu ? (
              <ul className={styles.menu} role="menu" onKeyDown={(e) => e.key === "Escape" && setMenu(false)}>
                {p.onSetCover && !p.isCover ? (
                  <li role="none">
                    <button type="button" role="menuitem" onClick={act(p.onSetCover)}>Set as cover</button>
                  </li>
                ) : null}
                {p.onEditAlt ? (
                  <li role="none">
                    <button type="button" role="menuitem" onClick={act(p.onEditAlt)}>Edit description</button>
                  </li>
                ) : null}
                {p.onRemove ? (
                  <li role="none">
                    <button type="button" role="menuitem" onClick={act(p.onRemove)}>Remove</button>
                  </li>
                ) : null}
              </ul>
            ) : null}
          </div>
        ) : null}

        {p.onHandlePointerDown ? (
          <button
            type="button"
            className={styles.handle}
            aria-label={`Move ${p.name}. Use the arrow keys, or drag.`}
            onPointerDown={p.onHandlePointerDown}
            onKeyDown={p.onHandleKeyDown}
          >
            <GripVertical size={18} aria-hidden="true" />
          </button>
        ) : null}
      </div>

      {p.editingAlt ? (
        <textarea
          className={styles.alt}
          aria-label={`Description for ${p.name}`}
          placeholder="Describe this image for people who can't see it"
          defaultValue={p.alt}
          rows={3}
          autoFocus
          onBlur={(e) => p.onSaveAlt?.(e.target.value)}
          onKeyDown={(e) => e.key === "Escape" && p.onCancelAlt?.()}
        />
      ) : null}
      {p.error ? <p className={styles.errorText}>{p.error}</p> : null}
      {p.warning ? <p className={styles.warning}>{p.warning}</p> : null}
    </div>
  );
}
