import type { PublicMedia } from "@senka/core";
import { cssVars, rowItemVars } from "../lib/style";
import styles from "./MediaView.module.css";

interface Props {
  media: PublicMedia;
  /** Description for screen readers: the image's own, or the work's title. */
  alt: string;
  /** True for the first image on the page, which should load first. */
  priority: boolean;
  /** The work's slug, on the first item only, so the grid thumbnail can morph into it. */
  name?: string;
}

const SHORT_CLIP_SECONDS = 30;

export function MediaView({ media, alt, priority, name }: Props) {
  const vars = { ...rowItemVars(media), ...(name ? { "--vt": `work-${name}` } : {}) };

  if (media.kind === "video") {
    const short = (media.duration ?? 0) > 0 && (media.duration ?? 0) <= SHORT_CLIP_SECONDS;
    return (
      <figure className={styles.figure} style={cssVars(vars)}>
        <video
          className={styles.media}
          src={media.src}
          poster={media.poster ?? undefined}
          width={media.width}
          height={media.height}
          muted
          loop={short}
          playsInline
          controls
          preload="metadata"
          data-autoplay={short ? "" : undefined}
          aria-label={alt}
        />
      </figure>
    );
  }

  return (
    <figure className={styles.figure} style={cssVars(vars)}>
      <a className={styles.zoom} href={media.full} data-full={media.full} data-alt={alt}>
        <img
          className={styles.media}
          src={media.src}
          srcSet={media.srcset ?? undefined}
          sizes={media.srcset ? "(min-width: 960px) 80vw, 100vw" : undefined}
          width={media.width}
          height={media.height}
          alt={alt}
          loading={priority ? undefined : "lazy"}
          fetchPriority={priority ? "high" : undefined}
          decoding="async"
        />
      </a>
    </figure>
  );
}
