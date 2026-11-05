import type { SiteLink } from "@senka/core/types";
import { safeHttpUrl } from "../lib/url";
import styles from "./SiteFooter.module.css";

interface Props {
  siteName: string;
  basePath: string;
  links: SiteLink[];
}

export function SiteFooter({ siteName, links }: Props) {
  const safe = links.flatMap((l) => {
    const href = safeHttpUrl(l.url);
    return href ? [{ label: l.label, href }] : [];
  });
  return (
    <footer className={styles.footer}>
      <p className={styles.mark}>
        © {new Date().getFullYear()} {siteName}
      </p>
      {safe.length > 0 ? (
        <ul className={styles.links}>
          {safe.map((l) => (
            <li key={l.href}>
              <a href={l.href} target="_blank" rel="noopener noreferrer">
                {l.label}
              </a>
            </li>
          ))}
        </ul>
      ) : null}
      <a className={styles.top} href="#">
        Back to top ↑
      </a>
    </footer>
  );
}
