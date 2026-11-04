#!/usr/bin/env node
// Fills your LOCAL database and bucket with sample works so every page has something to show while you design
// (in Onlook or the browser). It never touches the real site: it refuses to run with --remote.
//
//   pnpm seed:demo
//
// Safe to run again: it replaces only the sample works (ids 9001-9099) and leaves everything else alone.

import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";

if (process.argv.includes("--remote")) {
  console.error("Demo seed is local-only.");
  process.exit(1);
}

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const stateDir = path.join(root, ".wrangler", "state");

// 1. Make sure the local database has its tables and the two sites.
const wrangler = (...args) =>
  execFileSync("pnpm", ["--filter", "admin", "exec", "wrangler", ...args], { cwd: root, stdio: "pipe" });
wrangler("d1", "migrations", "apply", "senka-db", "--local", "--persist-to", stateDir);
wrangler("d1", "execute", "senka-db", "--local", "--persist-to", stateDir, "--file", path.join(root, "seed", "seed.sql"));

// 2. Talk to the same local database and bucket the dev servers use.
const adminRequire = createRequire(path.join(root, "apps", "admin", "package.json"));
const { getPlatformProxy } = await import(pathToFileURL(adminRequire.resolve("wrangler")).href);
const { env, dispose } = await getPlatformProxy({
  configPath: path.join(root, "apps", "admin", "wrangler.jsonc"),
  // wrangler's CLI and the dev servers keep their files under <state>/v3; the proxy wants that folder itself.
  persist: { path: path.join(stateDir, "v3") },
});

const TITLES = ["Blue Hour", "Study in Ochre", "Window, Late", "Harbour at Dusk", "Salt", "Two Chairs", "Long Shore", "Quiet Room"];
const RATIOS = [[3, 4], [4, 3], [1, 1], [16, 9], [2, 3], [3, 2], [9, 16], [21, 9], [4, 5]];
const PALETTES = [
  ["#5c78b1", "#9db4e0"], ["#c9a24b", "#ecd9a0"], ["#7d8f6b", "#c5d3b6"], ["#b5644a", "#e6b8a6"],
  ["#4a6f7c", "#a9c9d3"], ["#8c6a9a", "#cfb7d9"], ["#a89f8d", "#e3ddd0"], ["#3f4a63", "#98a3c0"], ["#d28f6b", "#f1cdb6"],
];
const MEDIA_LONG_EDGE = 2400;
const SITES = [
  { id: 1, base: 9001, offset: 0, tags: ["Painting", "Drawing", "Photo"] },
  { id: 2, base: 9011, offset: 3, tags: ["Drawing", "Etching", "Photo"] },
];
const MEDIUMS = ["Oil on linen", "Ink on paper", "Charcoal", "Graphite", "Etching", "Digital photograph"];
const slugOf = (name) => name.toLowerCase();
const escapeXml = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function dimensions(ratio) {
  const [w, h] = ratio;
  return w >= h
    ? { width: MEDIA_LONG_EDGE, height: Math.round((MEDIA_LONG_EDGE * h) / w) }
    : { height: MEDIA_LONG_EDGE, width: Math.round((MEDIA_LONG_EDGE * w) / h) };
}

/** A calm placeholder picture: a tinted field, a lighter inset and the title in small type. */
function svg(width, height, [bg, light], title) {
  const inset = Math.round(Math.min(width, height) * 0.08);
  const size = Math.max(10, Math.round(Math.min(width, height) * 0.045));
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">` +
    `<rect width="100%" height="100%" fill="${bg}"/>` +
    `<rect x="${inset}" y="${inset}" width="${width - 2 * inset}" height="${height - 2 * inset}" fill="${light}" opacity="0.55"/>` +
    `<text x="${inset * 1.5}" y="${height - inset * 1.4}" font-family="sans-serif" font-size="${size}" fill="#141414" opacity="0.7">${escapeXml(title)}</text>` +
    `</svg>`
  );
}

try {
  const db = env.DB;
  const statements = [
    db.prepare("DELETE FROM work_tags WHERE work_id BETWEEN 9001 AND 9099"),
    db.prepare("DELETE FROM media WHERE id BETWEEN 9001 AND 9099"),
    db.prepare("DELETE FROM works WHERE id BETWEEN 9001 AND 9099"),
    // local sign-in users for the dev servers (DEV_USER_EMAIL in apps/admin/.dev.vars)
    db.prepare("INSERT OR IGNORE INTO users (email, site_id) VALUES ('a@test.dev', 1), ('b@test.dev', 2)"),
  ];
  const uploads = [];

  for (const site of SITES) {
    for (const tag of site.tags) {
      statements.push(db.prepare("INSERT OR IGNORE INTO tags (site_id, name, slug) VALUES (?, ?, ?)").bind(site.id, tag, slugOf(tag)));
    }
    for (let i = 0; i < 9; i++) {
      const hidden = i === 8;
      const id = site.base + i;
      const title = hidden ? "Hidden draft" : TITLES[(i + site.offset) % TITLES.length];
      const ratio = RATIOS[(i + site.offset) % RATIOS.length];
      const palette = PALETTES[(i + site.offset) % PALETTES.length];
      const { width, height } = dimensions(ratio);
      const variants = ["original", "w480", "w1200"];
      const fields = {
        medium: MEDIUMS[(i + site.offset) % MEDIUMS.length],
        year: String(2025 - (i % 4)),
        description: `A sample piece, ${title.toLowerCase()}, made to show how a work page reads.`,
      };
      statements.push(
        db
          .prepare(
            `INSERT INTO works (id, site_id, slug, title, visible, sort, fields_json, cover_media_id)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          )
          .bind(id, site.id, `demo-${i + 1}`, title, hidden ? 0 : 1, 1000 + i, JSON.stringify(fields), id),
        db
          .prepare(
            `INSERT INTO media (id, site_id, work_id, kind, status, mime, width, height, color, alt, variants_json, bytes, sort)
             VALUES (?, ?, ?, 'image', 'ready', 'image/webp', ?, ?, ?, ?, ?, 1000, 1)`,
          )
          .bind(id, site.id, id, width, height, palette[0], `${title} (sample)`, JSON.stringify(variants)),
      );
      for (const tag of [site.tags[i % site.tags.length], ...(i % 3 === 0 ? [site.tags[(i + 1) % site.tags.length]] : [])]) {
        statements.push(
          db
            .prepare("INSERT OR IGNORE INTO work_tags (work_id, tag_id) SELECT ?, id FROM tags WHERE site_id = ? AND slug = ?")
            .bind(id, site.id, slugOf(tag)),
        );
      }
      for (const variant of variants) {
        const w = variant === "original" ? width : Number(variant.slice(1));
        const h = Math.round((height * w) / width);
        uploads.push(env.MEDIA.put(`${site.id}/${id}/${variant}`, svg(w, h, palette, title), { httpMetadata: { contentType: "image/svg+xml" } }));
      }
    }
    // bump the version so any cached page for this site is replaced
    statements.push(db.prepare("UPDATE sites SET content_version = content_version + 1 WHERE id = ?").bind(site.id));
  }

  await db.batch(statements);
  await Promise.all(uploads);
  const { n } = await db.prepare("SELECT count(*) AS n FROM works WHERE id BETWEEN 9001 AND 9099 AND visible = 1").first();
  console.log(`Demo content ready: ${n} visible works across site-a and site-b.`);
} finally {
  await dispose();
}
