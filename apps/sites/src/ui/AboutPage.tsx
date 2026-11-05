import type { SiteLink } from "@senka/core/types";
import { safeHttpUrl } from "../lib/url";
import { SiteFooter } from "./SiteFooter";
import { SiteHeader } from "./SiteHeader";
import styles from "./AboutPage.module.css";

interface Props {
  siteName: string;
  basePath: string;
  about: string;
  links: SiteLink[];
}

export function AboutPage({ siteName, basePath, about, links }: Props) {
  const paragraphs = about.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  const safeLinks = links.flatMap((l) => {
    const href = safeHttpUrl(l.url);
    return href ? [{ label: l.label, href }] : [];
  });
  return (
    <div className="page">
      <SiteHeader siteName={siteName} basePath={basePath} current="about" />
      <main id="main" className={styles.main}>
        {paragraphs.length === 0 && safeLinks.length === 0 ? <p className={styles.empty}>Nothing here yet.</p> : null}
        {paragraphs.map((p, i) => (
          <p key={i} className={i === 0 ? styles.lede : styles.paragraph}>
            {p}
          </p>
        ))}
        {safeLinks.length > 0 ? (
          <ul className={styles.links}>
            {safeLinks.map((l) => (
              <li key={l.href}>
                <a href={l.href} target="_blank" rel="noopener noreferrer">
                  {l.label}
                </a>
              </li>
            ))}
          </ul>
        ) : null}
      </main>
      <SiteFooter siteName={siteName} basePath={basePath} links={[]} />
    </div>
  );
}
