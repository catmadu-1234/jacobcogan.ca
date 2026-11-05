import { pageHref, type Filters, type View } from "../lib/filters";
import styles from "./ViewToggle.module.css";

interface Props {
  basePath: string;
  filters: Filters;
  view: View;
}

export function ViewToggle({ basePath, filters, view }: Props) {
  return (
    <nav className={styles.toggle} aria-label="View">
      <a href={pageHref(basePath, filters, "grid")} data-view="grid" aria-current={view === "grid" ? "page" : undefined}>
        Grid
      </a>
      <a href={pageHref(basePath, filters, "index")} data-view="index" aria-current={view === "index" ? "page" : undefined}>
        Index
      </a>
    </nav>
  );
}
