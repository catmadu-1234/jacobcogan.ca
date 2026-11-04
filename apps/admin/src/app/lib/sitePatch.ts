import type { SiteLink, ThemeConfig } from "@senka/core/types";

export interface SitePatch {
  name?: string;
  about?: string;
  links?: SiteLink[];
  theme?: Partial<ThemeConfig>;
}

/** Combines two queued settings patches; theme changes made close together are kept together. */
export function mergeSitePatch(older: Partial<SitePatch>, newer: Partial<SitePatch>): Partial<SitePatch> {
  const merged: Partial<SitePatch> = { ...older, ...newer };
  if (older.theme || newer.theme) merged.theme = { ...older.theme, ...newer.theme };
  return merged;
}
