import { useCallback, useEffect, useState } from "react";
import { FACETS, type Facet, type FacetValue } from "@senka/core/types";
import { tagSlug } from "@senka/core/slug";
import { api } from "./api";
import { showToast } from "./toast";

type ValueMap = Record<Facet, FacetValue[]>;
const empty = (): ValueMap => Object.fromEntries(FACETS.map((f) => [f, []])) as unknown as ValueMap;

/** The values this site uses for each facet, with a merge-aware rename. */
export function useFacetValues() {
  const [values, setValues] = useState<ValueMap>(empty());
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  const load = useCallback(async () => {
    try {
      setValues(await api<ValueMap>("GET", "/api/facets"));
      setStatus("ready");
    } catch {
      setStatus("error");
    }
  }, []);
  useEffect(() => void load(), [load]);

  /** The other value in the same facet that a rename would merge into (the server matches by slug). */
  function mergeTarget(value: FacetValue, name: string): FacetValue | null {
    const slug = tagSlug(name);
    return values[value.facet].find((v) => v.id !== value.id && v.slug === slug) ?? null;
  }

  async function rename(value: FacetValue, name: string): Promise<void> {
    try {
      await api("PATCH", `/api/facets/${value.id}`, { name });
    } catch {
      showToast("Couldn't rename that. Try again.");
    }
    await load();
  }

  return { values, status, mergeTarget, rename, reload: load };
}
