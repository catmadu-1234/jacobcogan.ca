import type { PublicWork } from "@senka/core";
import { safeHttpUrl } from "../lib/url";
import { Lightbox } from "./Lightbox";
import { MediaView } from "./MediaView";
import { SiteHeader } from "./SiteHeader";
import styles from "./WorkPage.module.css";

interface Neighbour {
  slug: string;
  title: string;
}

interface Props {
  siteName: string;
  basePath: string;
  work: PublicWork;
  prev: Neighbour | null;
  next: Neighbour | null;
}

export function WorkPage({ siteName, basePath, work, prev, next }: Props) {
  const title = work.title.trim() || "Untitled";
  const hasImage = work.media.some((m) => m.kind === "image");
  return (
    <div className="page">
      <SiteHeader siteName={siteName} basePath={basePath} current={null} />
      <main id="main">
        <div className={styles.media}>
          {work.media.map((m, i) => (
            <MediaView key={`${m.src}-${i}`} media={m} alt={m.alt || title} priority={i === 0} name={i === 0 ? work.slug : undefined} />
          ))}
        </div>

        <section className={styles.caption}>
          <h1 className={styles.title}>{title}</h1>
          <div className={styles.meta}>
            {work.details.length > 0 ? (
              <dl className={styles.details}>
                {work.details.map((d) => {
                  const link = d.type === "url" ? safeHttpUrl(d.value) : null;
                  return (
                    <div key={d.key} className={styles.detail}>
                      <dt>{d.label}</dt>
                      <dd>
                        {link ? (
                          <a href={link} target="_blank" rel="noopener noreferrer">
                            {d.value}
                          </a>
                        ) : (
                          d.value
                        )}
                      </dd>
                    </div>
                  );
                })}
              </dl>
            ) : null}
            {work.tags.length > 0 ? (
              <p className={styles.tags}>
                {work.tags.map((t) => (
                  <a key={t.slug} href={`${basePath}/tag/${t.slug}`}>
                    {t.name}
                  </a>
                ))}
              </p>
            ) : null}
          </div>
        </section>

        <nav className={styles.pager} aria-label="More work">
          {prev ? (
            <a rel="prev" href={`${basePath}/work/${prev.slug}`}>
              ← {prev.title || "Untitled"}
            </a>
          ) : (
            <span />
          )}
          {next ? (
            <a rel="next" href={`${basePath}/work/${next.slug}`}>
              {next.title || "Untitled"} →
            </a>
          ) : null}
        </nav>
      </main>
      {hasImage ? <Lightbox /> : null}
    </div>
  );
}
