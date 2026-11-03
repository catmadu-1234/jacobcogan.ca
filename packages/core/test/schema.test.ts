import { env } from "cloudflare:test";
import { it, expect } from "vitest";

it("creates all tables", async () => {
  const { results } = await env.DB.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE '\\_%' ESCAPE '\\' AND name NOT LIKE 'sqlite_%' AND name != 'd1_migrations' ORDER BY name"
  ).all();
  expect(results.map((r: any) => r.name)).toEqual(
    ["field_defs", "media", "sites", "tags", "users", "work_tags", "works"]
  );
});
