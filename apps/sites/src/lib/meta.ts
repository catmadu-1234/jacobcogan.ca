import type { PublicWork } from "@senka/core";

import type { View } from "./filters";

/** The home page can show the work as a picture grid or as a typographic index; the grid is the default. */
export function parseView(search: string | URLSearchParams): View {
  const params = typeof search === "string" ? new URLSearchParams(search) : search;
  return params.get("view") === "index" ? "index" : "grid";
}

/** The first sentence of the first paragraph, used as the line under an artist's name. */
export function firstSentence(text: string, max = 110): string {
  const paragraph = text.trim().split(/\n{2,}/)[0]?.replace(/\s+/g, " ").trim() ?? "";
  if (!paragraph) return "";
  const end = paragraph.search(/[.!?](\s|$)/);
  const sentence = end === -1 ? paragraph : paragraph.slice(0, end + 1);
  return sentence.length <= max ? sentence : `${sentence.slice(0, max - 1).trimEnd()}…`;
}

/** "2022–2025" from the Year details of the works, a single year when they agree, or nothing. */
export function yearRange(works: PublicWork[]): string {
  const years = works
    .flatMap((w) => w.details.filter((d) => d.key === "year" || d.label.toLowerCase() === "year"))
    .map((d) => /\b(1[89]\d\d|20\d\d)\b/.exec(d.value)?.[1])
    .filter((y): y is string => !!y)
    .map(Number);
  if (years.length === 0) return "";
  const [min, max] = [Math.min(...years), Math.max(...years)];
  return min === max ? String(min) : `${min}–${max}`;
}

/** "01", "02" … for numbering works in lists. */
export const workNumber = (index: number): string => String(index + 1).padStart(2, "0");

/**
 * A work's place in the display order. `next` wraps from the last work back to the first so a visitor can keep
 * browsing; `prev` is null at the start.
 */
export function neighbours(works: PublicWork[], slug: string) {
  const index = works.findIndex((w) => w.slug === slug);
  if (index === -1) return null;
  const only = works.length === 1;
  const wrapped = !only && index === works.length - 1;
  return {
    work: works[index]!,
    index,
    prev: index > 0 ? works[index - 1]! : null,
    next: only ? null : works[wrapped ? 0 : index + 1]!,
    wrapped,
  };
}
