import type { PublicWork } from "@senka/core";
import { facetAttrs, facetsOf, matches, type Filters } from "../lib/filters";
import { workNumber } from "../lib/meta";
import { cssVars, rowItemVars } from "../lib/style";
import styles from "./Rows.module.css";

interface Props {
  works: PublicWork[];
  basePath: string;
  rowHeight: number;
  showCaptions: boolean;
  filters?: Filters;
}

const EAGER_COUNT = 6;

export function Rows({ works, basePath, rowHeight, showCaptions, filters = {} }: Props) {
  return (
    <ul className={styles.rows} data-captions={showCaptions ? "always" : "hover"}>
      {works.map((w, i) => {
        const cover = w.cover;
        if (!cover) return null;
        const src = cover.kind === "video" ? cover.poster : cover.src;
        const srcset = cover.kind === "image" ? cover.srcset : null;
        const vars = rowItemVars(cover);
        const widthAtDesktop = Math.round(Number(vars["--ar"]) * rowHeight);
        return (
          <li
            key={w.slug}
            className={styles.item}
            {...facetAttrs(w)}
            hidden={!matches(facetsOf(w), filters) || undefined}
            style={cssVars({ ...vars, "--vt": `work-${w.slug}` })}
          >
            <a className={styles.link} href={`${basePath}/work/${w.slug}`}>
              {src ? (
                <img
                  className={styles.img}
                  src={src}
                  srcSet={srcset ?? undefined}
                  sizes={srcset ? `(max-width: 639px) 100vw, ${widthAtDesktop}px` : undefined}
                  width={cover.width}
                  height={cover.height}
                  alt={cover.alt || w.title}
                  loading={i < EAGER_COUNT ? undefined : "lazy"}
                  fetchPriority={i === 0 ? "high" : undefined}
                  decoding="async"
                />
              ) : null}
              <span className={styles.number} aria-hidden="true">
                {workNumber(i)}
              </span>
              <span className={styles.caption} aria-hidden={showCaptions ? undefined : true}>
                {w.title}
              </span>
            </a>
          </li>
        );
      })}
    </ul>
  );
}
