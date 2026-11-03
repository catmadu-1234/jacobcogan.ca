import type { Work } from "@senka/core/types";
import { api } from "./api";
import { navigate } from "./router";
import { showToast } from "./toast";

let inFlight = false;

/** Creates an empty work and opens its editor. Ignores repeat taps while one is being created. */
export async function createWorkAndOpen(): Promise<void> {
  if (inFlight) return;
  inFlight = true;
  try {
    const work = await api<Work>("POST", "/api/works");
    navigate(`#/works/${work.id}`);
  } catch {
    showToast("Couldn't add a work. Check your connection and try again.");
  } finally {
    inFlight = false;
  }
}
