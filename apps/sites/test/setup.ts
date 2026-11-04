import { env, applyD1Migrations } from "cloudflare:test";
import { beforeEach } from "vitest";

await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);

// The Cloudflare vitest plugin does not isolate storage per test: start every test from empty D1 tables and an empty bucket.
const TABLES_CHILD_FIRST = ["work_tags", "tags", "media", "works", "field_defs", "users", "sites"];
beforeEach(async () => {
  await env.DB.batch(TABLES_CHILD_FIRST.map((t) => env.DB.prepare(`DELETE FROM ${t}`)));
  let cursor: string | undefined;
  do {
    const page = await env.MEDIA.list({ cursor });
    if (page.objects.length) await env.MEDIA.delete(page.objects.map((o) => o.key));
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);
});
