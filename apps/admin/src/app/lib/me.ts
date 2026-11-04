import { useEffect } from "react";
import type { Site } from "@senka/core/types";
import { ApiError, api } from "./api";
import { createStore, useStore } from "./store";

export type MeState =
  | { status: "loading" }
  | { status: "ready"; email: string; site: Site; storageBytes: number }
  | { status: "error"; code: number };

export const meStore = createStore<MeState>({ status: "loading" });

export async function loadMe(): Promise<void> {
  meStore.set({ status: "loading" });
  try {
    const me = await api<{ email: string; site: Site; storageBytes: number }>("GET", "/api/me");
    meStore.set({ status: "ready", ...me });
  } catch (err) {
    meStore.set({ status: "error", code: err instanceof ApiError ? err.status : 0 });
  }
}

/** Keeps the cached site in step after settings are saved. */
export function updateMeSite(site: Site): void {
  const current = meStore.get();
  if (current.status === "ready") meStore.set({ ...current, site });
}

/** The signed-in user and their site; loads once on first use. */
export function useMe(): MeState {
  const state = useStore(meStore);
  useEffect(() => {
    if (meStore.get().status === "loading") void loadMe();
  }, []);
  return state;
}
