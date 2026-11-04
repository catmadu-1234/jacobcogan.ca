/** The address if it is an http(s) URL, otherwise null. Anything else (script, data, bare words) is never linked. */
export function safeHttpUrl(value: string): string | null {
  try {
    const url = new URL(value.trim());
    return url.protocol === "http:" || url.protocol === "https:" ? url.href : null;
  } catch {
    return null;
  }
}
