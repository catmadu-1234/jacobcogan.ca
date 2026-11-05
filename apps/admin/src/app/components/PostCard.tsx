import { useEffect, useState } from "react";
import { Play, Trash2, TextQuote } from "lucide-react";
import { formatDay } from "../lib/format";
import { thumbUrl } from "../lib/media";
import type { StudioPost } from "../lib/useStudio";
import { Button } from "./Button";
import { Switch } from "./Switch";
import styles from "./PostCard.module.css";

interface Props {
  post: StudioPost;
  onBody: (body: string) => void;
  onVisible: (visible: boolean) => void;
  onDelete: () => void;
}

/** One Studio post in the admin: its pictures, its words (editable in place) and its controls. */
export function PostCard({ post, onBody, onVisible, onDelete }: Props) {
  const [body, setBody] = useState(post.body);
  useEffect(() => setBody(post.body), [post.body]);
  const ready = post.media.filter((m) => m.status === "ready");

  return (
    <article className={styles.card}>
      {ready.length > 0 ? (
        <ul className={styles.media}>
          {ready.slice(0, 4).map((m) => {
            const src = thumbUrl(m);
            return (
              <li key={m.id} className={styles.thumb} style={m.color ? { backgroundColor: m.color } : undefined}>
                {src ? <img src={src} alt="" loading="lazy" decoding="async" /> : null}
                {m.kind === "video" ? <Play className={styles.play} size={20} aria-hidden="true" /> : null}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className={styles.thought}>
          <TextQuote size={16} aria-hidden="true" /> Thought
        </p>
      )}
      <textarea
        className={styles.words}
        value={body}
        rows={2}
        maxLength={5000}
        placeholder="Add words…"
        aria-label="Words for this post"
        onChange={(e) => setBody(e.target.value)}
        onBlur={() => body !== post.body && onBody(body)}
      />
      <div className={styles.foot}>
        <span className={styles.date}>{formatDay(post.createdAt)}</span>
        <Switch label={post.visible ? "Visible on site" : "Hidden"} checked={post.visible} onChange={onVisible} />
        <Button variant="ghost" onClick={onDelete} aria-label="Delete post">
          <Trash2 size={18} aria-hidden="true" />
        </Button>
      </div>
    </article>
  );
}
