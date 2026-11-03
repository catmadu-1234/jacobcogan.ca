import { deleteMedia, findMediaOfDeletedWorks, findOrphans, mediaKeys, purgeDeletedWorks } from "@senka/core";
import type { Env } from "./env";

const ORPHAN_AFTER_MS = 24 * 3600_000;
const PURGE_AFTER_MS = 30 * 24 * 3600_000;

/** R2 deletes at most 1000 keys per call. */
async function deleteKeys(bucket: R2Bucket, keys: string[]): Promise<void> {
  for (let i = 0; i < keys.length; i += 1000) await bucket.delete(keys.slice(i, i + 1000));
}

/**
 * Nightly housekeeping: drop uploads that never completed (pending for over a day) and purge works that have
 * sat in "deleted" for 30 days. Each step is independent, so one failing does not block the other.
 */
export async function runCleanup(
  env: Pick<Env, "DB" | "MEDIA">,
  now = new Date(),
): Promise<{ orphans: number; purged: number }> {
  let orphans = 0;
  let purged = 0;

  try {
    for (const m of await findOrphans(env.DB, new Date(now.getTime() - ORPHAN_AFTER_MS).toISOString())) {
      const keys = await deleteMedia(env.DB, m.siteId, m.id);
      if (keys) {
        await deleteKeys(env.MEDIA, keys);
        orphans++;
      }
    }
  } catch (err) {
    console.error("cleanup: orphan step failed", err);
  }

  try {
    const cutoff = new Date(now.getTime() - PURGE_AFTER_MS).toISOString();
    // Files first: purging the works removes the rows that say which files exist.
    await deleteKeys(env.MEDIA, (await findMediaOfDeletedWorks(env.DB, cutoff)).flatMap(mediaKeys));
    purged = (await purgeDeletedWorks(env.DB, cutoff)).length;
  } catch (err) {
    console.error("cleanup: purge step failed", err);
  }

  return { orphans, purged };
}
