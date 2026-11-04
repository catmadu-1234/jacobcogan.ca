import { ArrowLeft, Images } from "lucide-react";
import { thumbUrl } from "../lib/media";
import { useDragReorder } from "../lib/useDragReorder";
import { useEditor } from "../lib/useEditor";
import { Button } from "../components/Button";
import { EmptyState } from "../components/EmptyState";
import { MediaTile } from "../components/MediaTile";
import { SaveIndicator } from "../components/SaveIndicator";
import { Switch } from "../components/Switch";
import { TagInput } from "../components/TagInput";
import { TextField } from "../components/TextField";
import { UploadZone } from "../components/UploadZone";
import styles from "./Editor.module.css";

interface Props {
  id: number;
}

export function Editor({ id }: Props) {
  const ed = useEditor(id);
  const reorder = useDragReorder(ed.media, (ids) => void ed.reorderMedia(ids));

  if (ed.status === "loading") return <p aria-busy="true">Loading…</p>;
  if (ed.status !== "ready") {
    return (
      <EmptyState
        icon={<Images size={28} />}
        text={ed.status === "missing" ? "We couldn't find that work. It may have been deleted." : "We couldn't load this work."}
        actionLabel="Back to works"
        onAction={() => (window.location.hash = "#/works")}
      />
    );
  }

  const readyMedia = ed.media.filter((m) => m.status === "ready");
  const coverId = readyMedia.find((m) => m.id === ed.coverMediaId)?.id ?? readyMedia[0]?.id;
  const activeUploads = ed.uploads.filter((u) => u.state !== "done");
  const canReorder = reorder.shown.length > 1;

  return (
    <div className={styles.page}>
      <header className={styles.topbar}>
        <a className={styles.back} href="#/works">
          <ArrowLeft size={18} aria-hidden="true" /> Works
        </a>
        <SaveIndicator state={ed.saveState} onRetry={ed.retrySave} />
        <Switch label="Visible on site" checked={ed.visible} onChange={ed.changeVisible} />
      </header>

      {ed.saveState === "conflict" ? (
        <div className={styles.banner} role="alert">
          <span>This work changed in another tab. Reload to see the latest.</span>
          <Button variant="secondary" onClick={() => window.location.reload()}>
            Reload
          </Button>
        </div>
      ) : null}
      {ed.notice ? (
        <p className={styles.notice} role="status">
          {ed.notice}
        </p>
      ) : null}

      {/* Finished uploads leave the tray, so their format warnings stay here until the owner dismisses them. */}
      {ed.uploads
        .filter((u) => u.state === "done" && u.warning)
        .map((u) => (
          <div key={u.localId} className={`${styles.notice} ${styles.withAction}`} role="status">
            <span>
              {u.name}: {u.warning}
            </span>
            <Button variant="secondary" onClick={() => ed.uploader.dismiss(u.localId)}>
              Got it
            </Button>
          </div>
        ))}

      <section className={styles.section} aria-label="Images and videos">
        <div className={styles.tray}>
          {reorder.shown.map((m) => {
            const handlers = reorder.handlers(m.id);
            const name = m.alt || (m.kind === "video" ? "video" : "image");
            return (
              <MediaTile
                key={m.id}
                name={name}
                kind={m.kind}
                src={m.status === "ready" ? thumbUrl(m) : null}
                color={m.color}
                alt={m.alt}
                state={m.status === "ready" ? "ready" : "pending"}
                isCover={m.id === coverId}
                editingAlt={ed.editingAlt === m.id}
                reorderId={m.id}
                dragging={reorder.dragId === m.id}
                onSetCover={m.status === "ready" ? () => ed.changeCover(m.id) : undefined}
                onEditAlt={m.kind === "image" && m.status === "ready" ? () => ed.setEditingAlt(m.id) : undefined}
                onSaveAlt={(text) => void ed.saveAlt(m.id, text)}
                onCancelAlt={() => ed.setEditingAlt(null)}
                onRemove={() => ed.removeMedia(m)}
                onHandlePointerDown={canReorder ? handlers.onPointerDown : undefined}
                onHandleKeyDown={handlers.onKeyDown}
              />
            );
          })}
          {activeUploads.map((u) => (
            <MediaTile
              key={u.localId}
              name={u.name}
              kind={u.kind}
              src={u.kind === "image" ? u.preview : null}
              color={null}
              alt=""
              state={u.state === "done" ? "ready" : u.state}
              progress={u.progress}
              error={u.error}
              warning={u.warning}
              onRetry={() => ed.uploader.retry(u.localId)}
              onRemove={u.state === "error" ? () => ed.uploader.dismiss(u.localId) : undefined}
            />
          ))}
        </div>
        <UploadZone onFiles={(files) => ed.uploader.add(files)} />
      </section>

      <section className={styles.section}>
        <TextField label="Title" value={ed.title} onChange={ed.changeTitle} maxLength={200} placeholder="Untitled" />
      </section>

      <section className={styles.section} aria-labelledby="details-heading">
        <h2 id="details-heading" className={styles.heading}>
          Details
        </h2>
        {ed.defs.length === 0 ? (
          <p className={styles.hint}>
            Add details like Medium or Year for every work in <a href="#/settings">Settings</a>.
          </p>
        ) : null}
        {ed.defs.map((d) => (
          <TextField
            key={d.key}
            label={d.label}
            value={ed.fields[d.key] ?? ""}
            onChange={(v) => ed.changeField(d.key, v)}
            multiline={d.type === "longtext"}
            type={d.type === "url" ? "url" : "text"}
            required={d.required}
            error={ed.notice && d.required && !(ed.fields[d.key] ?? "").trim() ? "Needed to show this work on your site." : undefined}
            maxLength={10000}
          />
        ))}
      </section>

      <section className={styles.section} aria-labelledby="tags-heading">
        <h2 id="tags-heading" className={styles.heading}>
          Tags
        </h2>
        <TagInput tags={ed.tags} suggestions={ed.allTags} onChange={ed.changeTags} />
      </section>

      <section className={styles.danger}>
        <Button variant="secondary" onClick={() => void ed.deleteWork()}>
          Delete work
        </Button>
      </section>
    </div>
  );
}
