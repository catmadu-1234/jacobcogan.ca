import type { PublicPost } from "@senka/core";
import type { SiteLink } from "@senka/core/types";
import { Lightbox } from "./Lightbox";
import { SiteFooter } from "./SiteFooter";
import { SiteHeader } from "./SiteHeader";
import { StudioPost } from "./StudioPost";
import styles from "./StudioPage.module.css";

interface Props {
  siteName: string;
  basePath: string;
  posts: PublicPost[];
  links: SiteLink[];
}

const EAGER_POSTS = 4;

export function StudioPage({ siteName, basePath, posts, links }: Props) {
  let thoughts = 0;
  return (
    <div className="page">
      <SiteHeader siteName={siteName} basePath={basePath} current="studio" />
      <main id="main">
        <header className={styles.intro}>
          <h1 className={styles.title}>Studio</h1>
          <p className={styles.lede}>Work in progress, photos, clips and passing thoughts.</p>
        </header>
        {posts.length === 0 ? (
          <p className={styles.empty}>Nothing here yet.</p>
        ) : (
          <div className={styles.feed}>
            {posts.map((post, i) => (
              <StudioPost key={post.id} post={post} tone={post.media.length === 0 ? thoughts++ : 0} priority={i < EAGER_POSTS} />
            ))}
          </div>
        )}
      </main>
      {posts.some((p) => p.media.some((m) => m.kind === "image")) ? <Lightbox /> : null}
      <SiteFooter siteName={siteName} basePath={basePath} links={links} />
    </div>
  );
}
