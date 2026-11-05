import { pageHref, toggleFilter, type FacetSection, type Filters, type View } from "../lib/filters";
import styles from "./FilterRail.module.css";

interface Props {
  sections: FacetSection[];
  filters: Filters;
  basePath: string;
  view: View;
}

/** Medium, Project, Content, Exhibition and Year down the left margin. Every choice is a plain link, so it works without script. */
export function FilterRail({ sections, filters, basePath, view }: Props) {
  if (sections.length === 0) return null;
  const active = Object.keys(filters).length > 0;
  return (
    <aside className={styles.rail} data-filter-rail data-base={basePath} aria-label="Filter works">
      <div className={styles.head}>
        <h2 className={styles.heading}>Filter</h2>
        <a className={styles.clear} data-clear href={pageHref(basePath, {}, view)} hidden={!active || undefined}>
          Clear all
        </a>
      </div>
      {sections.map((section) => (
        <section key={section.key} className={styles.section}>
          <h3 className={styles.title}>{section.title}</h3>
          <ul className={styles.options}>
            {section.options.map((o) => (
              <li key={o.slug}>
                <a
                  className={styles.option}
                  href={pageHref(basePath, toggleFilter(filters, section.key, o.slug), view)}
                  data-facet={section.key}
                  data-value={o.slug}
                  aria-current={o.active ? "true" : undefined}
                  data-empty={o.count === 0 && !o.active ? "" : undefined}
                >
                  <span className={styles.label}>{o.label}</span>
                  <span className={styles.count} data-count>
                    {o.count}
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </aside>
  );
}
