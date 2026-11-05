const escapeXml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");

/** A sitemap for one site: home, about, and every visible work, as absolute URLs. */
export function buildSitemap(origin: string, basePath: string, workSlugs: string[]): string {
  const base = `${origin}${basePath}`;
  const paths = ["", "/about", ...workSlugs.map((s) => `/work/${s}`)];
  const urls = paths.map((p) => `  <url><loc>${escapeXml(p === "" && basePath === "" ? `${base}/` : `${base}${p}`)}</loc></url>`);
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join("\n")}\n</urlset>\n`;
}
