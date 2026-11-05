#!/usr/bin/env node
// Fills your LOCAL database and bucket with sample works so every page has something to show while you design
// (in Onlook or the browser). It never touches the real site: it refuses to run with --remote.
//
//   pnpm seed:demo
//
// Safe to run again: it replaces only the sample works (ids 9001-9099) and leaves everything else alone.
// The pictures are real photographs from picsum.photos (fixed ids, so they never change) cached in .wrangler/demo-art,
// so re-runs are quick and work offline. If a photo cannot be fetched, scripts/lib/demo-art.mjs draws one instead.
//   pnpm seed:demo -- --generated   always draw them instead

import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import sharp from "sharp";
import { tagSlug } from "../packages/core/src/slug.ts";
import { STYLE_INFO, artSpec, renderArtPng, dimensionsFor } from "./lib/demo-art.mjs";

if (process.argv.includes("--remote")) {
  console.error("Demo seed is local-only.");
  process.exit(1);
}

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const stateDir = path.join(root, ".wrangler", "state");
const artDir = path.join(root, ".wrangler", "demo-art");
const ART_VERSION = 3; // bump when the pictures change, to refetch or redraw the cached ones
const GENERATED_ONLY = process.argv.includes("--generated");
// Picsum photo ids, picked for landscapes, architecture and still life. One per work, so no two works share a picture.
const PHOTO_IDS = [1015, 1036, 1043, 1018, 1039, 1048, 1067, 1040, 1033, 1051, 1056, 1069, 1076, 1078, 164, 217, 274, 292, 1002, 1003, 1004, 1006, 1008, 1010, 1012, 1013, 1016, 1019, 1020, 1021];

/** A real photograph cropped to the given shape, or null when offline. */
async function fetchPhoto(id, { width, height }) {
  try {
    const res = await fetch(`https://picsum.photos/id/${id}/${width}/${height}.jpg`, { redirect: "follow", signal: AbortSignal.timeout(20000) });
    if (!res.ok) return null;
    return Buffer.from(await res.arrayBuffer());
  } catch {
    return null;
  }
}
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
    id: 1, index: 0, base: 9001, projects: ["Harbour Series", "Studies", "Interiors"], tags: ["Painting", "Drawing", "Photo", "Print"],
    demoName: "Jacob Cogan", placeholderName: "Site A", oldDemoName: "Elio Marsh",
    about: "Painter and printmaker working between oil, ink and light.\n\nBased by the sea. Taking commissions for the year ahead.",
    links: [{ label: "Instagram", url: "https://instagram.com/example" }, { label: "Shop", url: "https://example.com/shop" }],
    theme: { from: '{"preset":"grotesk"}', to: '{"preset":"grotesk","accent":"#E4452D"}' },
  },
  {
    id: 2, index: 1, base: 9011, projects: ["Weather Maps", "Small Books", "Field Notes"], tags: ["Painting", "Drawing", "Photo", "Print"],
    demoName: "Senka", placeholderName: "Site B", oldDemoName: "Mira Solano",
    about: "Drawing, mostly. Slowly.\n\nMira works in graphite, etching and watercolour, and is making a book of small weather maps.",
    links: [{ label: "Instagram", url: "https://instagram.com/example" }],
    theme: { from: '{"preset":"serif-title","accent":"#7A3E2E"}', to: '{"preset":"serif-title","accent":"#C2693F"}' },
  },
];

// Studio posts: a thought, a captioned photo, or a few photos. `photos` counts pictures; none means words only.
const POSTS = {
  1: [
    { body: "Work slowly. Look for longer than feels reasonable.", photos: 0 },
    { body: "Morning light on the jetty. Third attempt at the same corner.", photos: 1 },
    { body: "Thin layers, patient drying. The painting tells you when it's done.", photos: 0 },
    { body: "", photos: 1 },
    { body: "Studio this week: three panels, one very stubborn sky.", photos: 2 },
    { body: "Every mistake is a good place to start the next thing.", photos: 0 },
  ],
  2: [
    { body: "Graphite smudges the same way weather does.", photos: 0 },
    { body: "Field notes from the coast, page 14.", photos: 1 },
    { body: "Small books, small weather. Both fit in a pocket.", photos: 0 },
    { body: "Etching proofs drying on the line.", photos: 2 },
    { body: "", photos: 1 },
    { body: "Quiet days are for drawing; loud days are for printing.", photos: 0 },
  ],
};

const DESCRIPTIONS = {
  oil: "Layers of thin colour, scraped back and built up again over several weeks. Made at the window, in the afternoon.",
  ink: "Drawn quickly and without a plan, following the line wherever the pen wanted to go.",
  dusk: "Photographed in the last quarter hour of light, from the end of the jetty. Printed on cotton paper.",
  bauhaus: "A study in weight and balance, cut from painted paper and moved around until it stopped feeling wrong.",
  riso: "Two inks, printed one over the other and a little out of register on purpose.",
  contour: "A map of somewhere that does not exist, drawn from memory of several places that do.",
};
const CONTENT = ["Landscapes", "People", "Still life", "Architecture"];
const AVAILABILITY = ["Available", "Sold", "Available", "Private collection"];

const hex = ({ r, g, b }) => `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("")}`;

/** Draws (or loads from cache) one work's picture in the sizes a real upload would have. */
async function artwork(siteIndex, workIndex) {
  const spec = artSpec(siteIndex, workIndex);
  const dir = path.join(artDir, `v${ART_VERSION}-${siteIndex}-${workIndex}`);
  const metaFile = path.join(dir, "meta.json");
  if (!existsSync(metaFile)) {
    mkdirSync(dir, { recursive: true });
    const photo = GENERATED_ONLY ? null : await fetchPhoto(PHOTO_IDS[(siteIndex * 9 + workIndex) % PHOTO_IDS.length], dimensionsFor(spec.ratio, LONG_EDGE));
    if (!photo && !GENERATED_ONLY) console.warn(`Could not fetch photo for ${siteIndex}-${workIndex}; drawing one instead.`);
    const png = photo ?? (await renderArtPng(spec, LONG_EDGE));
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
    db.prepare("DELETE FROM work_facet_values WHERE work_id BETWEEN 9001 AND 9199"),
    db.prepare("DELETE FROM work_tags WHERE work_id BETWEEN 9001 AND 9199"),
    db.prepare("DELETE FROM media WHERE id BETWEEN 9001 AND 9199"),
    db.prepare("DELETE FROM works WHERE id BETWEEN 9001 AND 9199"),
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
      db.prepare("UPDATE sites SET name = ? WHERE id = ? AND name IN (?, ?)").bind(site.demoName, site.id, site.placeholderName, site.oldDemoName),
      db.prepare("UPDATE sites SET about = ? WHERE id = ? AND about = ''").bind(site.about, site.id),
      db.prepare("UPDATE sites SET links_json = ? WHERE id = ? AND links_json = '[]'").bind(JSON.stringify(site.links), site.id),
      db.prepare("UPDATE sites SET theme_json = ? WHERE id = ? AND theme_json = ?").bind(site.theme.to, site.id, site.theme.from),
    );
    for (let i = 0; i < 9; i++) {
      const hidden = i === 8;
      const id = site.base + i;
      const a = art.get(`${site.id}-${i}`);
      const info = STYLE_INFO[a.spec.style];
      const title = hidden ? "Hidden draft" : info.titles[a.spec.titleIndex];
      const long = 40 + ((i * 17 + site.index * 9) % 80);
      const short = Math.round((long * Math.min(a.width, a.height)) / Math.max(a.width, a.height));
      const fields = {
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
      );
      const facets = {
        medium: [info.medium],
        project: [site.projects[(i * 5 + site.index) % site.projects.length]],
        content: [CONTENT[(i + site.index) % CONTENT.length]],
        exhibition: [[], ["Spring Show 2025"], ["Spring Show 2025", "Open Studio"]][i % 3],
      };
      for (const [facet, names] of Object.entries(facets)) {
        for (const name of names) {
          statements.push(
            db.prepare("INSERT OR IGNORE INTO facet_values (site_id, facet, name, slug) VALUES (?, ?, ?, ?)").bind(site.id, facet, name, tagSlug(name)),
            db
              .prepare("INSERT OR IGNORE INTO work_facet_values (work_id, value_id) SELECT ?, id FROM facet_values WHERE site_id = ? AND facet = ? AND slug = ?")
              .bind(id, site.id, facet, tagSlug(name)),
          );
        }
      }
      for (const variant of a.variants) {
        uploads.push(
          env.MEDIA.put(`${site.id}/${id}/${variant}`, new Uint8Array(a.files[variant]), {
            httpMetadata: { contentType: variant === "original" ? "image/jpeg" : "image/webp" },
          }),
        );
      }
    }
    // Studio posts, newest first, a few hours apart.
    let postId = site.base + 100;
    let photoNo = 9;
    for (const [n, p] of POSTS[site.id].entries()) {
      const id = postId++;
      const created = new Date(Date.UTC(2026, 10, 4, 18, 0) - n * 31 * 3600 * 1000).toISOString();
      statements.push(
        db
          .prepare("INSERT INTO works (id, site_id, slug, title, visible, sort, fields_json, kind, body, created_at) VALUES (?, ?, ?, '', 1, ?, '{}', 'post', ?, ?)")
          .bind(id, site.id, `demo-post-${n + 1}`, 2000 + n, p.body, created),
      );
      for (let k = 0; k < p.photos; k++) {
        const a = await artwork(site.index, photoNo++);
        const mediaId = 9100 + (id - site.base - 100) * 3 + k + site.index * 40;
        statements.push(
          db
            .prepare(
              `INSERT INTO media (id, site_id, work_id, kind, status, mime, width, height, color, alt, variants_json, bytes, sort)
               VALUES (?, ?, ?, 'image', 'ready', 'image/jpeg', ?, ?, ?, '', ?, ?, ?)`,
            )
            .bind(mediaId, site.id, id, a.width, a.height, a.color, JSON.stringify(a.variants), Object.values(a.files).reduce((t, b) => t + b.length, 0), k + 1),
        );
        for (const variant of a.variants) {
          uploads.push(
            env.MEDIA.put(`${site.id}/${mediaId}/${variant}`, new Uint8Array(a.files[variant]), {
              httpMetadata: { contentType: variant === "original" ? "image/jpeg" : "image/webp" },
            }),
          );
        }
      }
    }
    // bump the version so any cached page for this site is replaced
    statements.push(db.prepare("UPDATE sites SET content_version = content_version + 1 WHERE id = ?").bind(site.id));
  }

  await db.batch(statements);
  await Promise.all(uploads);
  const { n } = await db.prepare("SELECT count(*) AS n FROM works WHERE id BETWEEN 9001 AND 9199 AND visible = 1 AND kind = 'work'").first();
  console.log(`Demo content ready: ${n} visible works across site-a and site-b.`);
} finally {
  await dispose();
}
