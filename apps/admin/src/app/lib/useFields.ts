import { useCallback, useEffect, useState } from "react";
import type { FieldDef } from "@senka/core/types";
import { api } from "./api";
import { showToast } from "./toast";

export interface NewDetail {
  label: string;
  type: FieldDef["type"];
  required: boolean;
}
export type DetailChange = Partial<Pick<FieldDef, "label" | "type" | "required" | "archived">>;

/** The site's "details" (custom text fields): list, add, edit, archive/restore and reorder. */
export function useFields() {
  const [defs, setDefs] = useState<FieldDef[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  const load = useCallback(async () => {
    try {
      setDefs(await api<FieldDef[]>("GET", "/api/fields"));
      setStatus("ready");
    } catch {
      setStatus("error");
    }
  }, []);
  useEffect(() => void load(), [load]);

  async function add(input: NewDetail): Promise<boolean> {
    try {
      const created = await api<FieldDef>("POST", "/api/fields", input);
      setDefs((list) => [...list, created]);
      return true;
    } catch {
      showToast("Couldn't add that detail. Try again.");
      return false;
    }
  }

  async function update(id: number, change: DetailChange): Promise<void> {
    setDefs((list) => list.map((d) => (d.id === id ? { ...d, ...change } : d)));
    try {
      await api("PATCH", `/api/fields/${id}`, change);
    } catch {
      showToast("Couldn't save that change. Try again.");
      void load();
    }
  }

  async function reorder(ids: number[]): Promise<void> {
    setDefs((list) => [...ids.map((id) => list.find((d) => d.id === id)!).filter(Boolean), ...list.filter((d) => d.archived)]);
    try {
      await api("PUT", "/api/fields/order", ids);
    } catch {
      showToast("Couldn't save the new order. Try again.");
      void load();
    }
  }

  return {
    status,
    active: defs.filter((d) => !d.archived),
    archived: defs.filter((d) => d.archived),
    add, update, reorder, reload: load,
  };
}
