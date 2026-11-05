import assert from "node:assert/strict";
import { test } from "node:test";
import sharp from "sharp";
import { ART_STYLES, STYLE_INFO, artSpec, buildArtSvg, dimensionsFor, mulberry32, renderArt } from "./lib/demo-art.mjs";

test("mulberry32 is deterministic and stays in [0, 1)", () => {
  const a = mulberry32(42);
  const b = mulberry32(42);
  const run = Array.from({ length: 50 }, () => a());
  assert.deepEqual(run, Array.from({ length: 50 }, () => b()));
  assert.ok(run.every((n) => n >= 0 && n < 1));
  assert.notDeepEqual(run, Array.from({ length: 50 }, ((c) => () => c())(mulberry32(43))));
});

test("dimensionsFor puts the long edge on the long side and keeps the ratio", () => {
  assert.deepEqual(dimensionsFor([3, 4], 2000), { width: 1500, height: 2000 });
  assert.deepEqual(dimensionsFor([16, 9], 1600), { width: 1600, height: 900 });
  assert.deepEqual(dimensionsFor([1, 1], 1200), { width: 1200, height: 1200 });
  assert.deepEqual(dimensionsFor([21, 9], 2100), { width: 2100, height: 900 });
});

test("a site's eight visible works use all six looks and are all different", () => {
  for (const site of [0, 1]) {
    const specs = Array.from({ length: 8 }, (_, i) => artSpec(site, i));
    assert.deepEqual(new Set(specs.map((s) => s.style)), new Set(ART_STYLES));
    assert.equal(new Set(specs.map((s) => s.seed)).size, 8);
  }
  const all = [0, 1].flatMap((site) => Array.from({ length: 9 }, (_, i) => artSpec(site, i)));
  assert.equal(new Set(all.map((s) => s.seed)).size, all.length, "no two works share a seed");
});

test("artSpec is deterministic", () => {
  assert.deepEqual(artSpec(1, 4), artSpec(1, 4));
});

test("every look has titles, a tag and a medium for the sample details", () => {
  for (const style of ART_STYLES) {
    const info = STYLE_INFO[style];
    assert.ok(info.titles.length >= 3 && info.tag && info.medium, style);
  }
});

test("every look produces well-formed SVG with no text in the picture", () => {
  for (const style of ART_STYLES) {
    const svg = buildArtSvg({ style, seed: 7, palette: ["#eee", "#a33", "#366", "#da4", "#124"], ...dimensionsFor([4, 3], 400) });
    assert.match(svg, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/, style);
    assert.ok(!svg.includes("NaN") && !svg.includes("undefined") && !svg.includes("Infinity"), `${style} has a bad number`);
    assert.ok(!svg.includes("<text"), `${style} must not contain text`);
  }
});

test("every look renders to a WebP of the requested size, and different seeds look different", async () => {
  for (const style of ART_STYLES) {
    const spec = { style, seed: 11, palette: ["#e8dcc4", "#b5442e", "#2f5d62", "#d9a441", "#1d2a44"], ratio: [4, 3] };
    const a = await renderArt(spec, 320);
    const meta = await sharp(a).metadata();
    assert.deepEqual([meta.format, meta.width, meta.height], ["webp", 320, 240], style);
    const b = await renderArt({ ...spec, seed: 12 }, 320);
    assert.notDeepEqual(a, b, `${style}: seed should change the picture`);
  }
});
