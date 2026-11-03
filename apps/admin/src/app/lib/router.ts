import { useMemo, useSyncExternalStore } from "react";

export type RouteName = "works" | "editor" | "tags" | "settings";
export interface Route {
  name: RouteName;
  params: Record<string, string>;
}

const WORKS: Route = { name: "works", params: {} };

export function parseHash(hash: string): Route {
  const parts = hash.replace(/^#/, "").split("/").filter(Boolean);
  if (parts.length === 1 && parts[0] === "tags") return { name: "tags", params: {} };
  if (parts.length === 1 && parts[0] === "settings") return { name: "settings", params: {} };
  if (parts.length === 2 && parts[0] === "works" && /^\d+$/.test(parts[1]!)) {
    return { name: "editor", params: { id: parts[1]! } };
  }
  return WORKS;
}

export function navigate(hash: string): void {
  window.location.hash = hash;
}

function subscribe(listener: () => void): () => void {
  window.addEventListener("hashchange", listener);
  return () => window.removeEventListener("hashchange", listener);
}

export function useRoute(): Route {
  const hash = useSyncExternalStore(subscribe, () => window.location.hash, () => "");
  return useMemo(() => parseHash(hash), [hash]);
}
