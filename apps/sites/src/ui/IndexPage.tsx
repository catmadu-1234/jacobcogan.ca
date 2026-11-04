import type { PublicWork } from "@senka/core";
import type { TagSummary } from "../lib/tags";
import { Rows } from "./Rows";
import { SiteHeader } from "./SiteHeader";
import { TagBar } from "./TagBar";
import styles from "./IndexPage.module.css";

interface Props {
  siteName: string;
  basePath: string;
  works: PublicWork[];
  tags: TagSummary[];
  activeTag: string | null;
  rowHeight: number;
  showCaptions: boolean;
}

export function IndexPage({ siteName, basePath, works, tags, activeTag, rowHeight, showCaptions }: Props) {
  return (
    <div className="page">
      <SiteHeader siteName={siteName} basePath={basePath} current="work" />
      <main id="main">
        {tags.length >= 2 ? <TagBar tags={tags} active={activeTag} basePath={basePath} /> : null}
        {works.length === 0 ? (
          <p className={styles.empty}>Nothing here yet.</p>
        ) : (
          <Rows works={works} basePath={basePath} rowHeight={rowHeight} showCaptions={showCaptions} />
        )}
      </main>
    </div>
  );
}
