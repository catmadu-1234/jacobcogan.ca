/**
 * Parses a single HTTP byte range for a file of `size` bytes.
 * Returns the slice to serve, `"invalid"` when it cannot be satisfied (answer 416),
 * or `null` when there is no usable range (answer with the whole file).
 */
export function parseRange(header: string | null, size: number): { offset: number; length: number } | "invalid" | null {
  const m = /^bytes=(\d*)-(\d*)$/.exec(header ?? "");
  if (!m || (m[1] === "" && m[2] === "")) return null;
  if (m[1] === "") {
    const suffix = Number(m[2]);
    if (suffix === 0 || size === 0) return "invalid";
    const length = Math.min(suffix, size);
    return { offset: size - length, length };
  }
  const start = Number(m[1]);
  const end = m[2] === "" ? size - 1 : Math.min(Number(m[2]), size - 1);
  if (m[2] !== "" && Number(m[2]) < start) return null;
  if (start >= size) return "invalid";
  return { offset: start, length: end - start + 1 };
}
