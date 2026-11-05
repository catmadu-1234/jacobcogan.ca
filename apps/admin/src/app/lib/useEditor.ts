import { useEffect, useMemo, useRef, useState } from "react";
import { FACETS, type Facet, type FacetValue, type FieldDef, type Media, type Work } from "@senka/core/types";
import { YEAR_PATTERN } from "@senka/core/validate";
import { ApiError, api, sendDelete } from "./api";
import { useAutosave } from "./autosave";
import { createPendingDeletes } from "./pendingDeletes";
import { navigate } from "./router";
import { useStore } from "./store";
import { showToast } from "./toast";
import { createUploader } from "./upload/uploader";

interface WorkResponse {
  work: Work;
  media: Media[];
  facets: Record<Facet, FacetValue[]>;
}
type FacetNames = Record<Facet, string[]>;
const emptyNames = (): FacetNames => ({ medium: [], project: [], content: [], exhibition: [] });
const namesOf = (map: Record<Facet, FacetValue[]>): FacetNames => Object.fromEntries(FACETS.map((f) => [f, map[f].map((v) => v.name)])) as FacetNames;
/** What to tell the artist when a Year is not four digits; empty when it is fine. */
export const yearProblem = (year: string): string => (year.trim() && !YEAR_PATTERN.test(year.trim()) ? "Use four digits, like 2024. It won't save until it does." : "");
export interface EditPatch {
  title?: string;
  visible?: boolean;
  fields?: Record<string, string>;
  facets?: Partial<FacetNames>;
  coverMediaId?: number | null;
}
export type EditorStatus = "loading" | "ready" | "missing" | "error";

/** Everything the work editor needs: loading, form state, autosave, media actions and deleting. */
export function useEditor(id: number) {
  const [status, setStatus] = useState<EditorStatus>("loading");
  const [title, setTitle] = useState("");
  const [visible, setVisible] = useState(false);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [facets, setFacets] = useState<FacetNames>(emptyNames());
  const [coverMediaId, setCoverMediaId] = useState<number | null>(null);
  const [media, setMedia] = useState<Media[]>([]);
  const [defs, setDefs] = useState<FieldDef[]>([]);
  const [allFacets, setAllFacets] = useState<FacetNames>(emptyNames());
  const [notice, setNotice] = useState<string | null>(null);
  const [editingAlt, setEditingAlt] = useState<number | null>(null);
  const updatedAt = useRef("");
  /** The last Year that was valid, so an unfinished one is never sent to the server. */
  const savedYear = useRef("");

  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    Promise.all([
      api<WorkResponse>("GET", `/api/works/${id}`),
      api<FieldDef[]>("GET", "/api/fields"),
      api<Record<Facet, FacetValue[]>>("GET", "/api/facets"),
    ])
      .then(([res, fieldDefs, facetList]) => {
        if (cancelled) return;
        updatedAt.current = res.work.updatedAt;
        setTitle(res.work.title);
        setVisible(res.work.visible);
        setFields(res.work.fields);
        setFacets(namesOf(res.facets));
        savedYear.current = res.work.fields.year ?? "";
        setCoverMediaId(res.work.coverMediaId);
        setMedia(res.media);
        setDefs(fieldDefs.filter((d) => !d.archived));
        setAllFacets(namesOf(facetList));
        setStatus("ready");
      })
      .catch((err) => !cancelled && setStatus(err instanceof ApiError && err.status === 404 ? "missing" : "error"));
    return () => {
      cancelled = true;
    };
  }, [id]);

  const { autosave, state, reason } = useAutosave<EditPatch>(async (patch) => {
    const send = (body: EditPatch) =>
      api<{ work: Work }>("PATCH", `/api/works/${id}`, { ...body, expectedUpdatedAt: updatedAt.current });
    let res: { work: Work };
    try {
      res = await send(patch);
    } catch (err) {
      if (!(err instanceof ApiError && err.status === 400 && err.body?.error === "missing-required")) throw err;
      // A work can't be shown on the site while a required detail is empty: save the rest, keep it hidden.
      setVisible(false);
      setNotice(`Hidden for now. Fill in ${(err.body.missing as string[]).join(", ")} to show this work on your site.`);
      res = await send({ ...patch, visible: false });
    }
    updatedAt.current = res.work.updatedAt;
  });

  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (autosave.hasUnsaved()) e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [autosave]);

  // ---- media ----
  const uploader = useMemo(() => createUploader(id, (m) => setMedia((list) => [...list, m])), [id]);
  const uploads = useStore(uploader.items);

  async function reloadMedia() {
    try {
      setMedia((await api<WorkResponse>("GET", `/api/works/${id}`)).media);
    } catch {
      /* the editor keeps showing what it has */
    }
  }

  async function reorderMedia(ids: number[]) {
    setMedia((list) => ids.map((mid) => list.find((m) => m.id === mid)!).filter(Boolean));
    try {
      await api("PUT", `/api/works/${id}/media/order`, ids);
    } catch {
      showToast("Couldn't save the new order. Try again.");
      void reloadMedia();
    }
  }

  async function saveAlt(mediaId: number, alt: string) {
    setEditingAlt(null);
    try {
      const updated = await api<Media>("PATCH", `/api/media/${mediaId}`, { alt });
      setMedia((list) => list.map((m) => (m.id === mediaId ? updated : m)));
    } catch {
      showToast("Couldn't save the description. Try again.");
    }
  }

  // Removing is undoable for 5 seconds; the server delete happens when that window closes, or at once if the
  // page goes away first (so a removed file cannot stay public).
  const pending = useRef(createPendingDeletes());
  useEffect(() => {
    const deletes = pending.current;
    const stop = deletes.install();
    return () => {
      stop();
      deletes.commitAll(false);
    };
  }, []);

  function removeMedia(target: Media) {
    const index = media.findIndex((m) => m.id === target.id);
    setMedia((list) => list.filter((m) => m.id !== target.id));
    pending.current.schedule(target.id, (keepalive) =>
      sendDelete(`/api/media/${target.id}`, keepalive)
        .then(() => setCoverMediaId((c) => (c === target.id ? null : c)))
        .catch(() => showToast("Couldn't remove that file. Reload and try again.")),
    );
    showToast("File removed", {
      label: "Undo",
      run: () => {
        if (!pending.current.cancel(target.id)) return;
        setMedia((list) => {
          const copy = [...list];
          copy.splice(Math.min(index, copy.length), 0, target);
          return copy;
        });
      },
    });
  }

  // ---- editing ----
  function changeTitle(value: string) {
    setTitle(value);
    autosave.queue({ title: value });
  }
  function changeField(key: string, value: string) {
    const next = { ...fields, [key]: value };
    setFields(next);
    setNotice(null);
    if (key === "year" && !yearProblem(value)) savedYear.current = value.trim();
    // Only a finished Year is sent: while it is half typed, the last good one goes along with the other details.
    const sendable = yearProblem(next.year ?? "") ? { ...next, year: savedYear.current } : next;
    if (key === "year" && yearProblem(value)) return;
    autosave.queue({ fields: sendable });
  }
  function changeFacet(facet: Facet, next: string[]) {
    // The whole set goes each time: queued patches merge shallowly, so a partial one would drop earlier edits.
    const all = { ...facets, [facet]: next };
    setFacets(all);
    autosave.queue({ facets: all });
  }
  function changeVisible(next: boolean) {
    setVisible(next);
    setNotice(null);
    autosave.queue({ visible: next });
  }
  function changeCover(mediaId: number) {
    setCoverMediaId(mediaId);
    autosave.queue({ coverMediaId: mediaId });
  }

  async function deleteWork() {
    try {
      await autosave.flush();
      await api("DELETE", `/api/works/${id}`);
      navigate("#/works");
      showToast("Work deleted", {
        label: "Undo",
        run: () =>
          api("POST", `/api/works/${id}/restore`)
            .then(() => navigate(`#/works/${id}`))
            .catch(() => showToast("Couldn't bring it back. Try again.")),
      });
    } catch {
      showToast("Couldn't delete this work. Try again.");
    }
  }

  return {
    status, title, visible, fields, facets, coverMediaId, media, defs, allFacets, notice, editingAlt, setEditingAlt,
    saveState: state, saveReason: reason, retrySave: () => autosave.retry(),
    uploader, uploads,
    changeTitle, changeField, changeFacet, changeVisible, changeCover,
    reorderMedia, saveAlt, removeMedia, deleteWork,
  };
}
