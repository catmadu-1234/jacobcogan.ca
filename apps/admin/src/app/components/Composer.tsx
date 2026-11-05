import { useEffect, useRef, useState } from "react";
import { ImagePlus, X } from "lucide-react";
import type { PublishProgress } from "../lib/publishPost";
import { Button } from "./Button";
import { ACCEPT } from "./UploadZone";
import styles from "./Composer.module.css";

interface Props {
  /** Resolves true when the post went up, so the composer can empty itself. */
  onPost: (body: string, files: File[]) => Promise<boolean>;
  posting: boolean;
  progress: PublishProgress | null;
}

interface Picked {
  file: File;
  url: string;
}

/** The quick-post box: some words, some photos or clips, one button. Built to be used with a thumb. */
export function Composer({ onPost, posting, progress }: Props) {
  const [body, setBody] = useState("");
  const [picked, setPicked] = useState<Picked[]>([]);
  const input = useRef<HTMLInputElement>(null);
  const area = useRef<HTMLTextAreaElement>(null);
  const pickedRef = useRef(picked);
  pickedRef.current = picked;

  // Free the preview pictures when the box goes away.
  useEffect(() => () => pickedRef.current.forEach((p) => URL.revokeObjectURL(p.url)), []);

  useEffect(() => {
    const el = area.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.max(el.scrollHeight, 96)}px`;
  }, [body]);

  function add(files: File[]) {
    setPicked((list) => [...list, ...files.map((file) => ({ file, url: URL.createObjectURL(file) }))]);
  }
  function drop(index: number) {
    setPicked((list) => {
      URL.revokeObjectURL(list[index]!.url);
      return list.filter((_, i) => i !== index);
    });
  }

  async function submit() {
    const ok = await onPost(body, picked.map((p) => p.file));
    if (!ok) return;
    picked.forEach((p) => URL.revokeObjectURL(p.url));
    setBody("");
    setPicked([]);
  }

  const empty = body.trim() === "" && picked.length === 0;
  return (
    <section className={styles.composer} aria-label="New post">
      <textarea
        ref={area}
        className={styles.text}
        value={body}
        maxLength={5000}
        placeholder="What's on your mind? Add words, photos or clips."
        aria-label="Words for this post"
        disabled={posting}
        onChange={(e) => setBody(e.target.value)}
      />
      {picked.length > 0 ? (
        <ul className={styles.picked}>
          {picked.map((p, i) => (
            <li key={p.url} className={styles.chosen}>
              {p.file.type.startsWith("video/") ? <video src={p.url} muted playsInline preload="metadata" /> : <img src={p.url} alt="" />}
              {posting ? null : (
                <button type="button" className={styles.remove} aria-label={`Remove ${p.file.name}`} onClick={() => drop(i)}>
                  <X size={14} aria-hidden="true" />
                </button>
              )}
            </li>
          ))}
        </ul>
      ) : null}
      <div className={styles.actions}>
        <Button variant="secondary" disabled={posting} onClick={() => input.current?.click()}>
          <ImagePlus size={18} aria-hidden="true" /> Photos or videos
        </Button>
        <input
          ref={input}
          className={styles.file}
          type="file"
          multiple
          accept={ACCEPT}
          tabIndex={-1}
          aria-hidden="true"
          onChange={(e) => {
            add(Array.from(e.target.files ?? []));
            e.target.value = "";
          }}
        />
        <Button busy={posting} disabled={empty} onClick={() => void submit()}>
          {posting && progress ? `Uploading ${Math.min(progress.finished + 1, progress.total)} of ${progress.total}` : "Post"}
        </Button>
      </div>
    </section>
  );
}
