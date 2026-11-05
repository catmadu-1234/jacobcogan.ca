#!/usr/bin/env node
// Fills your LOCAL database and bucket with sample works so every page has something to show while you design
// (in Onlook or the browser). It never touches the real site: it refuses to run with --remote.
//
//   pnpm seed:demo
//
// Safe to run again: it replaces only the sample works (ids 9001-9099) and leaves everything else alone.
// The artwork is drawn by scripts/lib/demo-art.mjs and cached in .wrangler/demo-art, so re-runs are quick.

import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import sharp from "sharp";
import { STYLE_INFO, artSpec, renderArtPng } from "./lib/demo-art.mjs";

if (process.argv.includes("--remote")) {
  console.error("Demo seed is local-only.");
  process.exit(1);
}

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const stateDir = path.join(root, ".wrangler", "state");
const artDir = path.join(root, ".wrangler", "demo-art");
const ART_VERSION = 2; // bump when demo-art.mjs changes how pictures look, to redraw the cached ones
const LONG_EDGE = 2000;

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

const SITES = [
  {
    id: 1, index: 0, base: 9001, tags: ["Painting", "Drawing", "Photo", "Print"],
    demoName: "Elio Marsh", placeholderName: "Site A",
    about: "Painter and printmaker working between oil, ink and light.\n\nBased by the sea. Taking commissions for the year ahead.",
    links: [{ label: "Instagram", url: "https://instagram.com/example" }, { label: "Shop", url: "https://example.com/shop" }],
    theme: { from: '{"preset":"grotesk"}', to: '{"preset":"grotesk","accent":"#E4452D"}' },
  },
  {
    id: 2, index: 1, base: 9011, tags: ["Painting", "Drawing", "Photo", "Print"],
    demoName: "Mira Solano", placeholderName: "Site B",
    about: "Drawing, mostly. Slowly.\n\nMira works in graphite, etching and watercolour, and is making a book of small weather maps.",
    links: [{ label: "Instagram", url: "https://instagram.com/example" }],
    theme: { from: '{"preset":"serif-title","accent":"#7A3E2E"}', to: '{"preset":"serif-title","accent":"#C2693F"}' },
  },
];

const DESCRIPTIONS = {
  oil: "Layers of thin colour, scraped back and built up again over several weeks. Made at the window, in the afternoon.",
  ink: "Drawn quickly and without a plan, following the line wherever the pen wanted to go.",
  dusk: "Photographed in the last quarter hour of light, from the end of the jetty. Printed on cotton paper.",
  bauhaus: "A study in weight and balance, cut from painted paper and moved around until it stopped feeling wrong.",
  riso: "Two inks, printed one over the other and a little out of register on purpose.",
  contour: "A map of somewhere that does not exist, drawn from memory of several places that do.",
};
const AVAILABILITY = ["Available", "Sold", "Available", "Private collection"];

const hex = ({ r, g, b }) => `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("")}`;

/** Draws (or loads from cache) one work's picture in the sizes a real upload would have. */
async function artwork(siteIndex, workIndex) {
  const spec = artSpec(siteIndex, workIndex);
  const dir = path.join(artDir, `v${ART_VERSION}-${siteIndex}-${workIndex}`);
  const metaFile = path.join(dir, "meta.json");
  if (!existsSync(metaFile)) {
    mkdirSync(dir, { recursive: true });
    const png = await renderArtPng(spec, LONG_EDGE);
    const { width, height } = await sharp(png).metadata();
    const { dominant } = await sharp(png).stats();
    const variants = ["original"];
    writeFileSync(path.join(dir, "original"), await sharp(png).jpeg({ quality: 88, mozjpeg: true }).toBuffer());
    for (const w of [480, 1200]) {
      if (w < width || w === 480) {
        writeFileSync(path.join(dir, `w${w}`), await sharp(png).resize({ width: Math.min(w, width) }).webp({ quality: w === 480 ? 78 : 82 }).toBuffer());
        variants.push(`w${w}`);
      }
    }
    writeFileSync(metaFile, JSON.stringify({ width, height, color: hex(dominant), variants }));
  }
  const meta = JSON.parse(readFileSync(metaFile, "utf8"));
  const files = Object.fromEntries(meta.variants.map((v) => [v, readFileSync(path.join(dir, v))]));
  return { spec, ...meta, files };
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

  // Draw all the pictures at once; each is independent.
  const art = new Map();
  await Promise.all(SITES.flatMap((site) => Array.from({ length: 9 }, async (_, i) => art.set(`${site.id}-${i}`, await artwork(site.index, i)))));

  for (const site of SITES) {
    // Friendly demo names, but only where the owner has not already chosen their own.
    statements.push(
      db.prepare("UPDATE sites SET name = ? WHERE id = ? AND name = ?").bind(site.demoName, site.id, site.placeholderName),
      db.prepare("UPDATE sites SET about = ? WHERE id = ? AND about = ''").bind(site.about, site.id),
      db.prepare("UPDATE sites SET links_json = ? WHERE id = ? AND links_json = '[]'").bind(JSON.stringify(site.links), site.id),
      db.prepare("UPDATE sites SET theme_json = ? WHERE id = ? AND theme_json = ?").bind(site.theme.to, site.id, site.theme.from),
    );
    for (const tag of site.tags) {
      statements.push(db.prepare("INSERT OR IGNORE INTO tags (site_id, name, slug) VALUES (?, ?, ?)").bind(site.id, tag, tag.toLowerCase()));
    }
    for (let i = 0; i < 9; i++) {
      const hidden = i === 8;
      const id = site.base + i;
      const a = art.get(`${site.id}-${i}`);
      const info = STYLE_INFO[a.spec.style];
      const title = hidden ? "Hidden draft" : info.titles[a.spec.titleIndex];
      const long = 40 + ((i * 17 + site.index * 9) % 80);
      const short = Math.round((long * Math.min(a.width, a.height)) / Math.max(a.width, a.height));
      const fields = {
        medium: info.medium,
        dimensions: a.width >= a.height ? `${long} × ${short} cm` : `${short} × ${long} cm`,
        year: String(2025 - (i % 4)),
        description: DESCRIPTIONS[a.spec.style],
        availability: AVAILABILITY[i % AVAILABILITY.length],
      };
      const bytes = Object.values(a.files).reduce((sum, b) => sum + b.length, 0);
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
             VALUES (?, ?, ?, 'image', 'ready', 'image/jpeg', ?, ?, ?, ?, ?, ?, 1)`,
          )
          .bind(id, site.id, id, a.width, a.height, a.color, `${title} (sample artwork)`, JSON.stringify(a.variants), bytes),
        db.prepare("INSERT OR IGNORE INTO work_tags (work_id, tag_id) SELECT ?, id FROM tags WHERE site_id = ? AND slug = ?").bind(id, site.id, info.tag.toLowerCase()),
      );
      for (const variant of a.variants) {
        uploads.push(
          env.MEDIA.put(`${site.id}/${id}/${variant}`, new Uint8Array(a.files[variant]), {
            httpMetadata: { contentType: variant === "original" ? "image/jpeg" : "image/webp" },
          }),
        );
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
