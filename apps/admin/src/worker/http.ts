import type { Context } from "hono";
import type { z } from "zod";

const MAX_JSON_BYTES = 256 * 1024;

export type Parsed<T> = { ok: true; data: T } | { ok: false; res: Response };

/** Reads a size-limited JSON body and validates it; failures come back as ready-to-return 400/413 responses. */
export async function readJson<S extends z.ZodType>(c: Context, schema: S): Promise<Parsed<z.infer<S>>> {
  // Web pages can send "plain text" bodies to any address without permission, so only real JSON is accepted.
  if (!(c.req.header("content-type") ?? "").toLowerCase().startsWith("application/json")) {
    return { ok: false, res: c.json({ error: "unsupported-media-type" }, 415) };
  }
  const declared = Number(c.req.header("content-length") ?? 0);
  if (declared > MAX_JSON_BYTES) return { ok: false, res: c.json({ error: "too-large" }, 413) };
  const text = await c.req.text();
  if (text.length > MAX_JSON_BYTES) return { ok: false, res: c.json({ error: "too-large" }, 413) };
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, res: c.json({ error: "invalid", issues: [{ path: "", message: "Body must be JSON" }] }, 400) };
  }
  const result = schema.safeParse(raw);
  if (!result.success) {
    const issues = result.error.issues.map((i) => ({ path: i.path.join("."), message: i.message }));
    return { ok: false, res: c.json({ error: "invalid", issues }, 400) };
  }
  return { ok: true, data: result.data };
}

/** Parses a numeric path id; anything else is simply "not found". */
export function parseId(raw: string): number | null {
  return /^\d{1,12}$/.test(raw) ? Number(raw) : null;
}

export const notFound = (c: Context) => c.json({ error: "not-found" }, 404);
