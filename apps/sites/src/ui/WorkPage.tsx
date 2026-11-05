import type { PublicMedia, PublicWork } from "@senka/core";
import type { SiteLink } from "@senka/core/types";
import { facetsOf, pageHref, type FacetKey } from "../lib/filters";
import { safeHttpUrl } from "../lib/url";
import { Lightbox } from "./Lightbox";
import { MediaView } from "./MediaView";
import { SiteFooter } from "./SiteFooter";
import { SiteHeader } from "./SiteHeader";
import styles from "./WorkPage.module.css";

interface Neighbour {
  slug: string;
  title: string;
  cover: PublicMedia | null;
}

interface Props {
  siteName: string;
  basePath: string;
  work: PublicWork;
  prev: Neighbour | null;
  next: Neighbour | null;
  /** True when `next` is the first work again, because this is the last one. */
  wrapped: boolean;
  links: SiteLink[];
}

const FACET_KEYS: string[] = ["medium", "project", "year"];

export function WorkPage({ siteName, basePath, work, prev, next, wrapped, links }: Props) {
  const title = work.title.trim() || "Untitled";
  const hasImage = work.media.some((m) => m.kind === "image");
  const facets = facetsOf(work);
  const short = work.details.filter((d) => d.type !== "longtext");
  const notes = work.details.filter((d) => d.type === "longtext");
  const nextCover = next?.cover ? (next.cover.kind === "video" ? next.cover.poster : next.cover.src) : null;
  return (
    <div className="page">
      <SiteHeader siteName={siteName} basePath={basePath} current={null} />
      <main id="main">
        <div className={styles.layout}>
          <section className={styles.caption}>
            <h1 className={styles.title}>{title}</h1>
            {short.length > 0 ? (
              <dl className={styles.details}>
                {short.map((d) => {
                  const link = d.type === "url" ? safeHttpUrl(d.value) : null;
                  const facet = FACET_KEYS.includes(d.key) ? facets[d.key as FacetKey] : undefined;
                  return (
                    <div key={d.key} className={styles.detail}>
                      <dt>{d.label}</dt>
                      <dd>
                        {link ? (
                          <a href={link} target="_blank" rel="noopener noreferrer">
                            {d.value}
                          </a>
                        ) : facet ? (
                          <a href={pageHref(basePath, { [d.key]: facet }, "grid")}>{d.value}</a>
                        ) : (
                          d.value
                        )}
                      </dd>
                    </div>
                  );
                })}
              </dl>
            ) : null}
            {notes.map((d) => (
              <div key={d.key} className={styles.note}>
                <h2 className={styles.noteLabel}>{d.label}</h2>
                <p>{d.value}</p>
              </div>
            ))}
            {work.tags.length > 0 ? (
              <p className={styles.tags}>
                {work.tags.map((t) => (
                  <a key={t.slug} href={pageHref(basePath, { tag: t.slug }, "grid")}>
                    {t.name}
                  </a>
                ))}
              </p>
            ) : null}
          </section>

          <div className={styles.media}>
            {work.media.map((m, i) => (
              <MediaView key={`${m.src}-${i}`} media={m} alt={m.alt || title} priority={i === 0} name={i === 0 ? work.slug : undefined} />
            ))}
          </div>
        </div>

        {prev ? (
          <nav className={styles.pager} aria-label="Previous work">
            <a rel="prev" href={`${basePath}/work/${prev.slug}`}>
              ← {prev.title || "Untitled"}
            </a>
          </nav>
        ) : null}

        {next ? (
          <a className={styles.finale} rel="next" href={`${basePath}/work/${next.slug}`}>
            <span className={styles.finaleLabel}>{wrapped ? "Back to the start" : "Next work"}</span>
            <span className={styles.finaleTitle}>{next.title || "Untitled"} →</span>
            {nextCover ? (
              <img
                className={styles.finaleImg}
                src={nextCover}
                srcSet={next.cover?.kind === "image" ? (next.cover.srcset ?? undefined) : undefined}
                sizes="100vw"
                alt=""
                loading="lazy"
                decoding="async"
              />
            ) : null}
          </a>
        ) : null}
      </main>
      <SiteFooter siteName={siteName} basePath={basePath} links={links} />
      {hasImage ? <Lightbox /> : null}
    </div>
  );
}
