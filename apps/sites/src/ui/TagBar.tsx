import type { TagSummary } from "../lib/tags";
import styles from "./TagBar.module.css";

interface Props {
  tags: TagSummary[];
  active: string | null;
  basePath: string;
}

export function TagBar({ tags, active, basePath }: Props) {
  const home = basePath === "" ? "/" : basePath;
  return (
    <nav className={styles.bar} aria-label="Filter by tag">
      <a href={home} aria-current={active === null ? "page" : undefined}>
        All
      </a>
      {tags.map((t) => (
        <a key={t.slug} href={`${basePath}/tag/${t.slug}`} aria-current={active === t.slug ? "page" : undefined}>
          {t.name}
        </a>
      ))}
    </nav>
  );
}
