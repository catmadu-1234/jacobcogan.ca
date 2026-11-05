const KB = 1024;
const MB = KB * 1024;
const GB = MB * 1024;

/** Human-readable size: whole numbers for bytes/KB, one decimal for MB/GB. Rolls over before showing "1024 KB". */
export function formatBytes(n: number): string {
  if (n < KB) return `${n} B`;
  if (n < MB - KB / 2) return `${Math.round(n / KB)} KB`;
  if (n < GB - MB / 20) return `${(n / MB).toFixed(1)} MB`;
  return `${(n / GB).toFixed(1)} GB`;
}

/** The free R2 allowance the storage meter measures against. */
export const STORAGE_LIMIT_BYTES = 10 * GB;
export const STORAGE_LIMIT_LABEL = "10 GB";

/** "4 Nov 2026" for a stored timestamp, in the viewer's own time zone. */
export function formatDay(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}
