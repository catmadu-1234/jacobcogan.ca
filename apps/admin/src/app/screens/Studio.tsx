import { Images, Sparkles } from "lucide-react";
import { useStudio } from "../lib/useStudio";
import { Composer } from "../components/Composer";
import { EmptyState } from "../components/EmptyState";
import { PostCard } from "../components/PostCard";
import styles from "./Studio.module.css";

/** Quick posts for the public Studio page: photos, clips and little thoughts, made to be filled in from a phone. */
export function Studio() {
  const { posts, state, posting, progress, reload, post, save, remove } = useStudio();
  return (
    <div className={styles.page}>
      <header className={styles.heading}>
        <p className={styles.eyebrow}>YOUR FEED</p>
        <h1 className={styles.title}>Studio</h1>
        <p className={styles.lede}>Share what you're making right now. Posts go straight onto your Studio page.</p>
      </header>

      <Composer onPost={post} posting={posting} progress={progress} />

      {state === "error" ? (
        <EmptyState icon={<Images size={28} />} text="We couldn't load your posts." actionLabel="Try again" onAction={reload} />
      ) : state === "loading" && posts.length === 0 ? (
        <p aria-busy="true" className={styles.loading}>
          Loading…
        </p>
      ) : posts.length === 0 ? (
        <EmptyState icon={<Sparkles size={28} />} title="Nothing in the Studio yet." text="Write a thought or add a photo above and press Post." />
      ) : (
        <div className={styles.feed}>
          {posts.map((p) => (
            <PostCard
              key={p.id}
              post={p}
              onBody={(body) => void save(p.id, { body })}
              onVisible={(visible) => void save(p.id, { visible })}
              onDelete={() => void remove(p)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
