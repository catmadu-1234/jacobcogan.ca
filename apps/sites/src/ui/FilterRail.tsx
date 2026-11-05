import { pageHref, toggleFilter, type FacetSection, type Filters, type View } from "../lib/filters";
import styles from "./FilterRail.module.css";

interface Props {
  sections: FacetSection[];
  filters: Filters;
  basePath: string;
  view: View;
  /** The name to show for an active tag filter; falls back to its slug. */
  activeTagName?: string;
}

/** Medium, Project and Year down the left margin. Every choice is a plain link, so it works without script. */
export function FilterRail({ sections, filters, basePath, view, activeTagName }: Props) {
  const tag = filters.tag;
  if (sections.length === 0 && !tag) return null;
  const active = Object.keys(filters).length > 0;
  const { tag: _tag, ...withoutTag } = filters;
  return (
    <aside className={styles.rail} data-filter-rail data-base={basePath} aria-label="Filter works">
      <div className={styles.head}>
        <h2 className={styles.heading}>Filter</h2>
        {active ? (
          <a className={styles.clear} data-clear href={pageHref(basePath, {}, view)}>
            Clear
          </a>
        ) : null}
      </div>
      {tag ? (
        <p className={styles.chip} data-tag-chip>
          <a href={pageHref(basePath, withoutTag, view)} aria-label={`Remove tag ${activeTagName ?? tag}`}>
            {activeTagName ?? tag} <span aria-hidden="true">×</span>
          </a>
        </p>
      ) : null}
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
