import type { PublicWork } from "@senka/core";
import { facetAttrs, facetsOf, matches, type Filters } from "../lib/filters";
import { workNumber } from "../lib/meta";
import { cssVars, rowItemVars } from "../lib/style";
import styles from "./IndexList.module.css";

interface Props {
  works: PublicWork[];
  basePath: string;
  filters?: Filters;
}

const yearOf = (work: PublicWork) => work.details.find((d) => d.key === "year")?.value ?? "";

/** The typographic view: one big line per work, with its picture appearing beside it on hover. */
export function IndexList({ works, basePath, filters = {} }: Props) {
  return (
    <ul className={styles.list}>
      {works.map((w, i) => {
        const cover = w.cover;
        if (!cover) return null;
        const src = cover.kind === "video" ? cover.poster : cover.src;
        const srcset = cover.kind === "image" ? cover.srcset : null;
        const year = yearOf(w);
        return (
          <li
            key={w.slug}
            className={styles.row}
            {...facetAttrs(w)}
            hidden={!matches(facetsOf(w), filters) || undefined}
            style={cssVars(rowItemVars(cover))}
          >
            <a className={styles.link} href={`${basePath}/work/${w.slug}`}>
              <span className={styles.number} aria-hidden="true">
                {workNumber(i)}
              </span>
              <span className={styles.title}>{w.title.trim() || "Untitled"}</span>
              <span className={styles.tags}>{w.tags.map((t) => t.name).join(", ")}</span>
              <span className={styles.year}>{year}</span>
              {src ? (
                <img
                  className={styles.preview}
                  src={src}
                  srcSet={srcset ?? undefined}
                  sizes={srcset ? "240px" : undefined}
                  alt=""
                  loading="lazy"
                  decoding="async"
                />
              ) : null}
            </a>
          </li>
        );
      })}
    </ul>
  );
}
