import type { D1Migration } from "@cloudflare/vitest-plugin";

declare global {
  namespace Cloudflare {
    interface Env {
      DB: D1Database;
      MEDIA: R2Bucket;
      MEDIA_BASE: string;
      TEST_MIGRATIONS: D1Migration[];
    }
  }
}
