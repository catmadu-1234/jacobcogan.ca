import type { PublicWork } from "@senka/core";
import type { SiteLink } from "@senka/core/types";
import { buildSections, filterWork, pageHref, type Filters, type View } from "../lib/filters";
import { yearRange } from "../lib/meta";
import { FilterRail } from "./FilterRail";
import { Hero } from "./Hero";
import { IndexList } from "./IndexList";
import { Rows } from "./Rows";
import { SiteFooter } from "./SiteFooter";
import { SiteHeader } from "./SiteHeader";
import { ViewToggle } from "./ViewToggle";
import styles from "./IndexPage.module.css";

interface Props {
  siteName: string;
  basePath: string;
  works: PublicWork[];
  tagline: string;
  links: SiteLink[];
  rowHeight: number;
  showCaptions: boolean;
  view: View;
  filters: Filters;
}

export function IndexPage({ siteName, basePath, works, tagline, links, rowHeight, showCaptions, view, filters }: Props) {
  const sections = buildSections(works, filters);
  const showing = filterWork(works, filters).length;
  const active = Object.keys(filters).length > 0;
  const hasRail = sections.length > 0;

  return (
    <div className="page">
      <SiteHeader siteName={siteName} basePath={basePath} current="work" />
      <main id="main">
        <Hero name={siteName} tagline={tagline} count={showing} total={works.length} years={yearRange(works)} />
        {works.length === 0 ? (
          <p className={styles.empty}>Nothing here yet.</p>
        ) : (
          <div className={styles.body} data-gallery data-view-mode={view} data-has-rail={hasRail ? "" : undefined}>
            <FilterRail sections={sections} filters={filters} basePath={basePath} view={view} />
            <section className={styles.results} aria-label="Works">
              <div className={styles.bar}>
                <a className={styles.showAll} data-clear href={pageHref(basePath, {}, view)} hidden={!active || undefined}>
                  Show all works
                </a>
                <ViewToggle basePath={basePath} filters={filters} view={view} />
              </div>
              {view === "index" ? (
                <IndexList works={works} basePath={basePath} filters={filters} />
              ) : (
                <Rows works={works} basePath={basePath} rowHeight={rowHeight} showCaptions={showCaptions} filters={filters} />
              )}
              <div className={styles.none} data-empty-state hidden={showing > 0 || undefined}>
                <p>No work matches those choices.</p>
                <a className={styles.clearAll} href={pageHref(basePath, {}, view)} data-clear>
                  Show all works
                </a>
              </div>
            </section>
          </div>
        )}
      </main>
      <SiteFooter siteName={siteName} basePath={basePath} links={links} />
    </div>
  );
}
