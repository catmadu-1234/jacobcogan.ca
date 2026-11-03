export type FieldType = "text" | "longtext" | "url";
export type MediaVariant = "original" | "w480" | "w1200" | "w2400" | "poster";

export interface ThemeConfig {
  preset: "grotesk" | "serif-title";
  accent: string;
  rowHeight: number;
  showIndexCaptions: boolean;
}
export interface SiteLink { label: string; url: string }
export interface Site {
  id: number; slug: string; name: string; hostname: string | null;
  theme: ThemeConfig; about: string; links: SiteLink[]; contentVersion: number;
}
export interface FieldDef {
  id: number; siteId: number; key: string; label: string; type: FieldType;
  required: boolean; sort: number; archived: boolean;
}
export interface Work {
  id: number; siteId: number; slug: string; title: string; visible: boolean; sort: number;
  fields: Record<string, string>; coverMediaId: number | null;
  createdAt: string; updatedAt: string; deletedAt: string | null;
}
export interface Media {
  id: number; siteId: number; workId: number | null; kind: "image" | "video";
  status: "pending" | "ready"; mime: string; width: number; height: number;
  duration: number | null; color: string | null; alt: string; variants: MediaVariant[];
  bytes: number; sort: number; createdAt: string;
}
export interface Tag { id: number; siteId: number; name: string; slug: string; count?: number }

export const DEFAULT_THEME: ThemeConfig = {
  preset: "grotesk", accent: "#141414", rowHeight: 320, showIndexCaptions: false,
};
export const MAX_UPLOAD_BYTES = 90 * 1024 * 1024;
/** The only content types media may be stored and served as (never HTML, SVG or scripts). */
export const ALLOWED_MIME = [
  "image/jpeg", "image/png", "image/webp", "image/gif", "image/avif",
  "video/mp4", "video/webm", "video/quicktime",
] as const;
