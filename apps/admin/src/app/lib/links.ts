import type { SiteLink } from "@senka/core/types";

export interface LinkRow {
  label: string;
  url: string;
}

const MISSING = "Add both a name and a web address.";
const BAD_URL = "The web address must start with http:// or https://.";

function isHttpUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

/** Trims the rows, drops fully blank ones, and reports problems per row (keyed by the row's position). */
export function cleanLinks(rows: LinkRow[]): { ok: true; links: SiteLink[] } | { ok: false; errors: Record<number, string> } {
  const links: SiteLink[] = [];
  const errors: Record<number, string> = {};
  rows.forEach((row, i) => {
    const label = row.label.trim();
    const url = row.url.trim();
    if (!label && !url) return;
    if (!label || !url) errors[i] = MISSING;
    else if (!isHttpUrl(url)) errors[i] = BAD_URL;
    else links.push({ label, url });
  });
  return Object.keys(errors).length ? { ok: false, errors } : { ok: true, links };
}
