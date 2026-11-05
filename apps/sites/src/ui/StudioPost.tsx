import type { PublicPost } from "@senka/core";
import { cssVars, rowItemVars } from "../lib/style";
import styles from "./StudioPost.module.css";

interface Props {
  post: PublicPost;
  /** 0, 1 or 2: a thought's colourway, so a run of thoughts does not look the same. */
  tone: number;
  /** True for the first few cards, whose pictures should load straight away. */
  priority: boolean;
}

/** "4 Nov 2026", the same for every visitor wherever they are. */
export function postDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}

const SHORT_THOUGHT = 140;
const SHORT_CLIP_SECONDS = 30;

export function StudioPost({ post, tone, priority }: Props) {
  const paragraphs = post.body.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  const date = postDate(post.createdAt);

  if (post.media.length === 0) {
    return (
      <article className={styles.thought} data-tone={tone % 3} data-short={post.body.length <= SHORT_THOUGHT ? "" : undefined}>
        <div className={styles.words}>
          {paragraphs.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>
        <time className={styles.date} dateTime={post.createdAt}>
          {date}
        </time>
      </article>
    );
  }

  return (
    <article className={styles.post}>
      {post.media.map((m, i) =>
        m.kind === "video" ? (
          <video
            key={m.src}
            className={styles.media}
            style={cssVars(rowItemVars(m))}
            src={m.src}
            poster={m.poster ?? undefined}
            width={m.width}
            height={m.height}
            muted
            loop
            playsInline
            controls
            preload="metadata"
            data-autoplay={(m.duration ?? 0) > 0 && (m.duration ?? 0) <= SHORT_CLIP_SECONDS ? "" : undefined}
            aria-label={post.body.trim().slice(0, 100) || "Clip"}
          />
        ) : (
          <a key={m.src} className={styles.zoom} href={m.full} data-full={m.full} data-alt={post.body.trim().slice(0, 100)}>
            <img
              className={styles.media}
              style={cssVars(rowItemVars(m))}
              src={m.src}
              srcSet={m.srcset ?? undefined}
              sizes={m.srcset ? "(min-width: 1100px) 30vw, (min-width: 640px) 45vw, 100vw" : undefined}
              width={m.width}
              height={m.height}
              alt={post.body.trim().slice(0, 100)}
              loading={priority && i === 0 ? undefined : "lazy"}
              decoding="async"
            />
          </a>
        ),
      )}
      <div className={styles.caption}>
        {paragraphs.map((p, i) => (
          <p key={i}>{p}</p>
        ))}
        <time className={styles.date} dateTime={post.createdAt}>
          {date}
        </time>
      </div>
    </article>
  );
}
