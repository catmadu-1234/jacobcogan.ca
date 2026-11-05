// Procedural placeholder artwork for the local demo content: six different looks (oil painting, ink drawing,
// dusk photograph, Bauhaus study, risograph print, topographic contours), each drawn from a seed so every run
// gives the same pictures. Rendered to real raster images with sharp, like an actual upload.
import sharp from "sharp";

export const ART_STYLES = ["oil", "ink", "dusk", "bauhaus", "riso", "contour"];

/** Sample details that suit each look: titles, the tag, and the medium. */
export const STYLE_INFO = {
  oil: { titles: ["Blue Hour", "Study in Ochre", "Window, Late"], tag: "Painting", medium: "Oil" },
  ink: { titles: ["Quiet Room", "Field Notes", "Two Chairs"], tag: "Drawing", medium: "Ink" },
  dusk: { titles: ["Harbour at Dusk", "Long Shore", "Last Light"], tag: "Photo", medium: "Photography" },
  bauhaus: { titles: ["Study for a Sun", "Counterweight", "Arc and Square"], tag: "Print", medium: "Gouache" },
  riso: { titles: ["Salt", "Paper Moths", "Slow Weather"], tag: "Print", medium: "Risograph" },
  contour: { titles: ["Tide Table", "Weather Map", "Inland Sea"], tag: "Drawing", medium: "Watercolour" },
};

const RATIOS = [[3, 4], [4, 3], [1, 1], [16, 9], [2, 3], [3, 2], [9, 16], [21, 9], [4, 5]];

// [paper/background, a, b, c, d] — what each slot means is up to the look.
const PALETTES = {
  oil: [["#e8dcc4", "#b5442e", "#2f5d62", "#d9a441", "#1d2a44"], ["#e9e1d3", "#7d8f6b", "#c9724f", "#3b4a63", "#e0b97a"], ["#dfd6c6", "#8c6a9a", "#d28f6b", "#2e4a5a", "#f1d9a8"]],
  ink: [["#f1ead9", "#b5442e", "#6b7a8f", "#1a1816", "#8a7f6a"], ["#ece6da", "#2f5d62", "#9db0a3", "#1a1816", "#c0b49e"]],
  dusk: [["#f4c9a0", "#f08a5d", "#6a4c93", "#1b1b3a", "#0f1224"], ["#cfe3ea", "#f6b89a", "#4a6fa5", "#1d2b53", "#0a1020"], ["#f6d5a8", "#e07a5f", "#81527e", "#2b2d42", "#111320"]],
  bauhaus: [["#ece3d1", "#c1272d", "#1f3a5f", "#f2b705", "#141414"], ["#e8e0d0", "#e4572e", "#17bebb", "#ffc914", "#2e282a"]],
  riso: [["#f2ecdf", "#ff5fa2", "#3b5bdb", "#ffd43b", "#1b1b1b"], ["#efe8da", "#ff6b6b", "#339af0", "#fcc419", "#212529"]],
  contour: [["#10151f", "#58e0b9", "#f7d46b", "#ee6a5b", "#e9eef5"], ["#0f1a17", "#d9c98b", "#7cb7a6", "#e8825d", "#efe9d8"], ["#efe9dc", "#1f3a5f", "#b5442e", "#2f5d62", "#1a1816"]],
};

/** A small, fast, seedable random number generator (returns numbers in [0, 1)). */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Pixel size for a picture with the given aspect ratio whose long side is `longEdge`. */
export function dimensionsFor([w, h], longEdge) {
  return w >= h
    ? { width: longEdge, height: Math.round((longEdge * h) / w) }
    : { height: longEdge, width: Math.round((longEdge * w) / h) };
}

/** Which look, palette, shape and seed the n-th work of a site gets. Deterministic, and varied within a site. */
export function artSpec(siteIndex, workIndex) {
  const style = ART_STYLES[(workIndex * 5 + siteIndex * 2) % ART_STYLES.length];
  const pool = PALETTES[style];
  return {
    style,
    seed: 1000 + siteIndex * 100 + workIndex * 7,
    palette: pool[(workIndex + siteIndex) % pool.length],
    ratio: RATIOS[(workIndex + siteIndex * 3) % RATIOS.length],
    titleIndex: (Math.floor(workIndex / ART_STYLES.length) + siteIndex) % STYLE_INFO[style].titles.length,
  };
}

// ---------- small helpers ----------

const n = (v) => Math.round(v * 10) / 10;
/** A noise frequency expressed per picture size, so a picture looks the same at any resolution. */
const freq = (perMinDim, m) => Number((perMinDim / m).toFixed(6));

function rgb(hex) {
  let h = hex.replace("#", "");
  if (h.length === 3) h = [...h].map((c) => c + c).join("");
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
}
function mix(a, b, t) {
  const [ra, ga, ba] = rgb(a);
  const [rb, gb, bb] = rgb(b);
  const c = (x, y) => Math.round(x + (y - x) * t).toString(16).padStart(2, "0");
  return `#${c(ra, rb)}${c(ga, gb)}${c(ba, bb)}`;
}
const pick = (rnd, list) => list[Math.floor(rnd() * list.length)];

/** Film grain and a soft vignette, shared by every look. */
const grainDefs = (seed) => `
<filter id="grain" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="${seed}"/><feColorMatrix type="saturate" values="0"/><feComponentTransfer><feFuncA type="table" tableValues="0 0.2"/></feComponentTransfer></filter>
<radialGradient id="vig" cx="50%" cy="50%" r="75%"><stop offset="55%" stop-color="#000" stop-opacity="0"/><stop offset="100%" stop-color="#000" stop-opacity="0.34"/></radialGradient>`;
const finish = `<rect width="100%" height="100%" fill="url(#vig)"/><rect width="100%" height="100%" filter="url(#grain)"/>`;

function wrap({ seed, width: W, height: H }, defs, body) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><defs>${grainDefs(seed)}${defs}</defs>${body}${finish}</svg>`;
}

// ---------- the six looks ----------

function oil(s) {
  const { seed, palette, width: W, height: H } = s;
  const rnd = mulberry32(seed);
  const m = Math.min(W, H);
  const [bg, ...cols] = palette;
  const blobs = Array.from({ length: 20 }, () => {
    const cx = rnd() * W, cy = rnd() * H;
    return `<ellipse cx="${n(cx)}" cy="${n(cy)}" rx="${n(m * (0.1 + rnd() * 0.28))}" ry="${n(m * (0.06 + rnd() * 0.2))}" transform="rotate(${n(rnd() * 180)} ${n(cx)} ${n(cy)})" fill="${pick(rnd, cols)}" opacity="${n(0.7 + rnd() * 0.25)}"/>`;
  }).join("");
  const streaks = Array.from({ length: 46 }, () => {
    const x = rnd() * W, y = rnd() * H;
    return `<rect x="${n(x)}" y="${n(y)}" width="${n(W * (0.12 + rnd() * 0.4))}" height="${n(Math.max(1.5, m * 0.004 * (1 + rnd() * 3)))}" transform="rotate(${n(-12 + rnd() * 24)} ${n(x)} ${n(y)})" fill="${rnd() < 0.5 ? "#fff" : "#000"}" opacity="${n(0.05 + rnd() * 0.07)}"/>`;
  }).join("");
  const defs = `<filter id="paint" x="-20%" y="-20%" width="140%" height="140%"><feTurbulence type="fractalNoise" baseFrequency="${freq(2.9, m)} ${freq(4.6, m)}" numOctaves="3" seed="${seed}" result="t"/><feDisplacementMap in="SourceGraphic" in2="t" scale="${n(m * 0.09)}" xChannelSelector="R" yChannelSelector="G" result="d"/><feGaussianBlur in="d" stdDeviation="${n(m * 0.003)}"/></filter>`;
  return wrap(s, defs, `<rect width="100%" height="100%" fill="${bg}"/><g filter="url(#paint)">${blobs}</g><g filter="url(#paint)">${streaks}</g>`);
}

function ink(s) {
  const { seed, palette, width: W, height: H } = s;
  const rnd = mulberry32(seed);
  const m = Math.min(W, H);
  const [bg, accent, wash, dark] = palette;
  const p1 = rnd() * 6.28, p2 = rnd() * 6.28, fx = (2 + rnd() * 3) / W * 3, fy = (2 + rnd() * 3) / H * 3;
  const angle = (x, y) => Math.sin(x * fx + p1) * Math.PI + Math.cos(y * fy + p2) * Math.PI * 0.9 + Math.sin((x + y) * fx * 0.5) * 1.2;
  const step = m * 0.007;
  const lines = Array.from({ length: 260 }, (_, k) => {
    let x = rnd() * W, y = rnd() * H;
    const pts = [`M${n(x)} ${n(y)}`];
    for (let i = 0; i < 70; i++) {
      const a = angle(x, y);
      x += Math.cos(a) * step;
      y += Math.sin(a) * step;
      if (x < 0 || y < 0 || x > W || y > H) break;
      pts.push(`L${n(x)} ${n(y)}`);
    }
    const hot = k % 23 === 0;
    return `<path d="${pts.join("")}" fill="none" stroke="${hot ? accent : dark}" stroke-width="${n(m * (hot ? 0.004 : 0.0012 + rnd() * 0.0028))}" stroke-linecap="round" opacity="${n(0.55 + rnd() * 0.35)}"/>`;
  }).join("");
  const defs = `<filter id="soft"><feGaussianBlur stdDeviation="${n(m * 0.05)}"/></filter>`;
  const washes = `<circle cx="${n(W * (0.3 + rnd() * 0.4))}" cy="${n(H * (0.3 + rnd() * 0.4))}" r="${n(m * 0.36)}" fill="${wash}" opacity="0.22" filter="url(#soft)"/>`;
  return wrap(s, defs, `<rect width="100%" height="100%" fill="${bg}"/>${washes}${lines}`);
}

function dusk(s) {
  const { seed, palette, width: W, height: H } = s;
  const rnd = mulberry32(seed);
  const m = Math.min(W, H);
  const [horizon, warm, mid, deep, darkest] = palette;
  const sunX = W * (0.3 + rnd() * 0.4), sunY = H * (0.55 + rnd() * 0.07);
  const layers = 5;
  const hills = Array.from({ length: layers }, (_, k) => {
    const t = k / (layers - 1);
    const baseY = H * (0.6 + k * 0.075);
    const amp = H * (0.03 + k * 0.012);
    const f1 = (1.5 + rnd() * 2) / W * 6.28, f2 = (4 + rnd() * 4) / W * 6.28, p1 = rnd() * 6.28, p2 = rnd() * 6.28;
    const pts = [];
    for (let x = 0; x <= W + 1; x += W / 48) pts.push(`L${n(x)} ${n(baseY - amp * (0.6 * Math.sin(x * f1 + p1) + 0.4 * Math.sin(x * f2 + p2)))}`);
    const fill = mix(mix(mid, horizon, 0.4), darkest, 0.05 + t * 0.92);
    return `<path d="M0 ${H}${pts.join("")}L${W} ${H}Z" fill="${fill}"/><rect y="${n(baseY - H * 0.06)}" width="${W}" height="${n(H * 0.08)}" fill="url(#mist)" opacity="${n(0.5 - t * 0.35)}"/>`;
  }).join("");
  const stars = Array.from({ length: 50 }, () => `<circle cx="${n(rnd() * W)}" cy="${n(rnd() * H * 0.32)}" r="${n(m * (0.0005 + rnd() * 0.0015))}" fill="#fff" opacity="${n(0.25 + rnd() * 0.5)}"/>`).join("");
  const defs = `<linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${deep}"/><stop offset="0.45" stop-color="${mid}"/><stop offset="0.78" stop-color="${warm}"/><stop offset="1" stop-color="${horizon}"/></linearGradient>
<radialGradient id="glow" cx="${n(sunX)}" cy="${n(sunY)}" r="${n(m * 0.55)}" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="${horizon}" stop-opacity="0.95"/><stop offset="0.35" stop-color="${warm}" stop-opacity="0.45"/><stop offset="1" stop-color="${warm}" stop-opacity="0"/></radialGradient>
<linearGradient id="mist" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset="0.6" stop-color="#fff" stop-opacity="0.5"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>`;
  return wrap(s, defs, `<rect width="100%" height="100%" fill="url(#sky)"/>${stars}<rect width="100%" height="100%" fill="url(#glow)"/><circle cx="${n(sunX)}" cy="${n(sunY)}" r="${n(m * 0.065)}" fill="${horizon}"/>${hills}`);
}

function bauhaus(s) {
  const { seed, palette, width: W, height: H } = s;
  const rnd = mulberry32(seed);
  const m = Math.min(W, H);
  const [bg, a, b, c, dark] = palette;
  const cell = m / 6;
  const snap = (v) => Math.round(v / (cell / 2)) * (cell / 2);
  const colors = [a, b, c, dark];
  const shapes = [`<circle cx="${n(snap(W * (0.3 + rnd() * 0.4)))}" cy="${n(snap(H * (0.3 + rnd() * 0.4)))}" r="${n(cell * (1.6 + rnd() * 0.8))}" fill="${a}"/>`];
  for (let i = 0; i < 9; i++) {
    const x = snap(rnd() * W), y = snap(rnd() * H), k = Math.floor(rnd() * 5), col = colors[(i + 1) % colors.length], r = cell * (0.6 + rnd() * 1.6);
    if (k === 0) shapes.push(`<circle cx="${n(x)}" cy="${n(y)}" r="${n(r)}" fill="${col}" opacity="0.94"/>`);
    else if (k === 1) shapes.push(`<path d="M${n(x - r)} ${n(y)}A${n(r)} ${n(r)} 0 0 1 ${n(x + r)} ${n(y)}Z" fill="${col}"/>`);
    else if (k === 2) shapes.push(`<rect x="${n(x)}" y="${n(y)}" width="${n(cell * (0.7 + rnd() * 2))}" height="${n(cell * (0.7 + rnd() * 2))}" fill="${col}" opacity="0.95"/>`);
    else if (k === 3) shapes.push(`<path d="M${n(x)} ${n(y)}h${n(r)}A${n(r)} ${n(r)} 0 0 1 ${n(x)} ${n(y + r)}Z" fill="${col}"/>`);
    else shapes.push(`<rect x="${n(x)}" y="${n(y)}" width="${n(m * 0.012)}" height="${n(cell * (1.4 + rnd() * 2.2))}" fill="${dark}"/>`);
  }
  const lines = Array.from({ length: 3 }, () => `<line x1="${n(snap(rnd() * W))}" y1="${n(snap(rnd() * H))}" x2="${n(snap(rnd() * W))}" y2="${n(snap(rnd() * H))}" stroke="${dark}" stroke-width="${n(m * 0.005)}"/>`).join("");
  return wrap(s, "", `<rect width="100%" height="100%" fill="${bg}"/>${shapes.join("")}${lines}`);
}

function riso(s) {
  const { seed, palette, width: W, height: H } = s;
  const rnd = mulberry32(seed);
  const m = Math.min(W, H);
  const [paper, inkA, inkB, inkC] = palette;
  const s1 = Math.max(7, m * 0.014), s2 = Math.max(6, m * 0.011);
  const defs = `<pattern id="dotsA" width="${n(s1)}" height="${n(s1)}" patternUnits="userSpaceOnUse" patternTransform="rotate(15)"><circle cx="${n(s1 / 2)}" cy="${n(s1 / 2)}" r="${n(s1 * 0.3)}" fill="${inkA}"/></pattern>
<pattern id="dotsB" width="${n(s2)}" height="${n(s2)}" patternUnits="userSpaceOnUse" patternTransform="rotate(52)"><circle cx="${n(s2 / 2)}" cy="${n(s2 / 2)}" r="${n(s2 * 0.26)}" fill="${inkB}"/></pattern>`;
  const shapes = [];
  for (let i = 0; i < 4; i++) {
    const cx = W * (0.2 + rnd() * 0.6), cy = H * (0.2 + rnd() * 0.6), rx = m * (0.18 + rnd() * 0.22), ry = m * (0.14 + rnd() * 0.22), rot = n(rnd() * 180);
    const fill = i % 2 === 0 ? "url(#dotsA)" : "url(#dotsB)";
    shapes.push(`<ellipse cx="${n(cx)}" cy="${n(cy)}" rx="${n(rx)}" ry="${n(ry)}" transform="rotate(${rot} ${n(cx)} ${n(cy)})" fill="${fill}" opacity="0.92"/>`);
    // a second ink, printed slightly out of register
    shapes.push(`<ellipse cx="${n(cx + m * 0.012)}" cy="${n(cy - m * 0.01)}" rx="${n(rx * 0.7)}" ry="${n(ry * 0.7)}" transform="rotate(${rot} ${n(cx)} ${n(cy)})" fill="${i % 2 === 0 ? "url(#dotsB)" : "url(#dotsA)"}" opacity="0.8"/>`);
  }
  shapes.push(`<circle cx="${n(W * (0.25 + rnd() * 0.5))}" cy="${n(H * (0.25 + rnd() * 0.5))}" r="${n(m * 0.09)}" fill="${inkC}" opacity="0.88"/>`);
  return wrap(s, defs, `<rect width="100%" height="100%" fill="${paper}"/>${shapes.join("")}`);
}

function contour(s) {
  const { seed, palette, width: W, height: H } = s;
  const rnd = mulberry32(seed);
  const m = Math.min(W, H);
  const [bg, a, b, c] = palette;
  const aspect = 0.7 + rnd() * 0.6;
  const rings = (cx, cy, count, step, from, to, width, opacity) =>
    Array.from({ length: count }, (_, k) => `<ellipse cx="${n(cx)}" cy="${n(cy)}" rx="${n(step * (k + 1) * aspect)}" ry="${n(step * (k + 1))}" fill="none" stroke="${mix(from, to, k / count)}" stroke-width="${n(width)}" opacity="${opacity}"/>`).join("");
  const defs = `<filter id="warp" x="-30%" y="-30%" width="160%" height="160%"><feTurbulence type="fractalNoise" baseFrequency="${freq(1.9, m)} ${freq(2.5, m)}" numOctaves="3" seed="${seed}" result="t"/><feDisplacementMap in="SourceGraphic" in2="t" scale="${n(m * 0.3)}" xChannelSelector="R" yChannelSelector="G"/></filter>`;
  const body =
    `<rect width="100%" height="100%" fill="${bg}"/><g filter="url(#warp)">` +
    rings(W * (0.3 + rnd() * 0.4), H * (0.3 + rnd() * 0.4), 30, m * 0.03, a, c, m * 0.0035, 1) +
    rings(W * (0.3 + rnd() * 0.4), H * (0.3 + rnd() * 0.4), 22, m * 0.036, b, a, m * 0.0024, 0.65) +
    `</g>`;
  return wrap(s, defs, body);
}

const PAINTERS = { oil, ink, dusk, bauhaus, riso, contour };

/** The SVG for one picture. Contains no text: it is meant to look like a work, not a placeholder label. */
export function buildArtSvg({ style, seed, palette, width, height }) {
  return PAINTERS[style]({ seed, palette, width, height });
}

/** Renders a picture to a lossless PNG whose long side is `longEdge` pixels. */
export async function renderArtPng(spec, longEdge) {
  const { width, height } = dimensionsFor(spec.ratio, longEdge);
  return sharp(Buffer.from(buildArtSvg({ ...spec, width, height })), { density: 72 }).png().toBuffer();
}

/** Renders a picture to WebP. */
export async function renderArt(spec, longEdge) {
  return sharp(await renderArtPng(spec, longEdge)).webp({ quality: 88 }).toBuffer();
}
