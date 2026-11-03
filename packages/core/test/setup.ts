import { env, applyD1Migrations } from "cloudflare:test";
import { beforeEach } from "vitest";

await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);

// The Cloudflare vitest plugin does not isolate storage per test, so every test starts from empty tables.
const TABLES_CHILD_FIRST = ["work_tags", "tags", "media", "works", "field_defs", "users", "sites"];
beforeEach(async () => {
  await env.DB.batch(TABLES_CHILD_FIRST.map((t) => env.DB.prepare(`DELETE FROM ${t}`)));
});
