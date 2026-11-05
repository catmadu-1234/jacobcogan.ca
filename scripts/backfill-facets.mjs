#!/usr/bin/env node
// Copies each work's old free-text Medium and Project details into the new facets (several values, split on commas
// and semicolons). Safe to run again: it only adds values and links that are missing, and never removes anything.
// The old text stays in each work's details as a record.
//
//   node scripts/backfill-facets.mjs --remote     the real site
//   node scripts/backfill-facets.mjs --local      the local copy

import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { tagSlug } from "../packages/core/src/slug.ts";

const target = process.argv.includes("--remote") ? "--remote" : process.argv.includes("--local") ? "--local" : null;
if (!target) {
  console.error("Say which database: --remote or --local.");
  process.exit(1);
}
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const run = (...args) =>
  execFileSync("pnpm", ["--filter", "admin", "exec", "wrangler", "d1", "execute", "senka-db", target, ...(target === "--local" ? ["--persist-to", path.join(root, ".wrangler", "state")] : []), ...args], { cwd: root, encoding: "utf8", maxBuffer: 1 << 26 });

const raw = run("--json", "--command", "SELECT id, site_id, fields_json FROM works WHERE kind = 'work'");
const rows = JSON.parse(raw.slice(raw.indexOf("[")))[0].results;
const q = (text) => `'${String(text).replace(/'/g, "''")}'`;

const statements = [];
let values = 0;
for (const row of rows) {
  const fields = JSON.parse(row.fields_json || "{}");
  for (const facet of ["medium", "project"]) {
    const seen = new Set();
    for (const part of String(fields[facet] ?? "").split(/[,;]/)) {
      const name = part.replace(/\s+/g, " ").trim().slice(0, 40);
      if (!name || seen.has(tagSlug(name))) continue;
      seen.add(tagSlug(name));
      values++;
      statements.push(
        `INSERT OR IGNORE INTO facet_values (site_id, facet, name, slug) VALUES (${row.site_id}, ${q(facet)}, ${q(name)}, ${q(tagSlug(name))});`,
        `INSERT OR IGNORE INTO work_facet_values (work_id, value_id) SELECT ${row.id}, id FROM facet_values WHERE site_id = ${row.site_id} AND facet = ${q(facet)} AND slug = ${q(tagSlug(name))};`,
      );
    }
  }
}
if (statements.length === 0) {
  console.log("Nothing to copy.");
  process.exit(0);
}
const file = path.join(mkdtempSync(path.join(tmpdir(), "facets-")), "backfill.sql");
writeFileSync(file, statements.join("\n") + "\n");
run("--file", file);
console.log(`Copied ${values} Medium/Project values from ${rows.length} works into facets.`);
