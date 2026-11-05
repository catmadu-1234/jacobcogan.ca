export class ApiError extends Error {
  constructor(
    public status: number,
    public body: any,
  ) {
    super(`API error ${status}`);
  }
}

type Storage = { getItem(key: string): string | null; setItem(key: string, value: string): void };

const RELOAD_KEY = "senka:last-reload";
const RELOAD_COOLDOWN_MS = 10_000;

function sessionStorageOrNull(): Storage | null {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

/** Reloads the page so Cloudflare Access can sign the user in again, but never more than once per 10 s (no loops). */
export function reloadOnce(
  storage: Storage | null = sessionStorageOrNull(),
  now = Date.now(),
  reload: () => void = () => window.location.reload(),
): boolean {
  try {
    const last = storage?.getItem(RELOAD_KEY) ?? null;
    if (last !== null && now - Number(last) < RELOAD_COOLDOWN_MS) return false;
    storage?.setItem(RELOAD_KEY, String(now));
  } catch {
    // storage blocked: fall through and reload anyway
  }
  reload();
  return true;
}

let onUnauthenticated: () => void = () => void reloadOnce();
export function setUnauthenticatedHandler(fn: () => void): void {
  onUnauthenticated = fn;
}

export async function api<T = unknown>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(path, {
    method,
    credentials: "same-origin",
    headers: body !== undefined ? { "content-type": "application/json" } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let parsed: any = undefined;
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = text;
    }
  }
  // "choose-side" is the open-sides picker asking a question, not a lost session: reloading would not help.
  if (res.status === 401 && parsed?.error !== "choose-side") onUnauthenticated();
  if (!res.ok) throw new ApiError(res.status, parsed);
  return parsed as T;
}

/** A DELETE that the browser may finish after the page is gone (used when closing the tab with deletes waiting). */
export function sendDelete(path: string, keepalive: boolean): Promise<unknown> {
  if (!keepalive) return api("DELETE", path);
  return fetch(path, { method: "DELETE", credentials: "same-origin", keepalive: true }).then((res) => {
    if (!res.ok) throw new ApiError(res.status, null);
  });
}
