export const MAX_TAGS = 20;
export const MAX_TAG_LENGTH = 40;
const MAX_SUGGESTIONS = 8;

/** Adds a tag unless it is empty, a duplicate (ignoring case) or would exceed 20 tags. */
export function addTag(tags: string[], raw: string): string[] {
  const name = raw.trim().slice(0, MAX_TAG_LENGTH);
  if (!name || tags.length >= MAX_TAGS) return tags;
  if (tags.some((t) => t.toLowerCase() === name.toLowerCase())) return tags;
  return [...tags, name];
}

/** Existing tags that match what is being typed (prefix matches first), and whether to offer creating a new one. */
export function suggest(query: string, all: string[], selected: string[]): { matches: string[]; canCreate: boolean } {
  const q = query.trim().toLowerCase();
  if (!q) return { matches: [], canCreate: false };
  const chosen = new Set(selected.map((t) => t.toLowerCase()));
  const pool = all.filter((t) => !chosen.has(t.toLowerCase()));
  const starts = pool.filter((t) => t.toLowerCase().startsWith(q));
  const contains = pool.filter((t) => !t.toLowerCase().startsWith(q) && t.toLowerCase().includes(q));
  const known = new Set([...all, ...selected].map((t) => t.toLowerCase()));
  return { matches: [...starts, ...contains].slice(0, MAX_SUGGESTIONS), canCreate: !known.has(q) };
}
