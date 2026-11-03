import type { Media } from "@senka/core/types";

/** Owner-only preview URL for one stored file (served by the admin Worker, works for hidden works too). */
export const fileUrl = (mediaId: number, variant: string): string => `/api/media/${mediaId}/file/${variant}`;

/** The smallest image variant that still looks sharp in a thumbnail, or a video's poster frame. */
export function thumbUrl(m: Media): string | null {
  if (m.kind === "video") return m.variants.includes("poster") ? fileUrl(m.id, "poster") : null;
  const variant = (["w480", "w1200", "w2400"] as const).find((v) => m.variants.includes(v)) ?? "original";
  return fileUrl(m.id, variant);
}
