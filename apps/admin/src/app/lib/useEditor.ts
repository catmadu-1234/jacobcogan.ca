import { useEffect, useMemo, useRef, useState } from "react";
import type { FieldDef, Media, Tag, Work } from "@senka/core/types";
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
  tags: Tag[];
}
export interface EditPatch {
  title?: string;
  visible?: boolean;
  fields?: Record<string, string>;
  tags?: string[];
  coverMediaId?: number | null;
}
export type EditorStatus = "loading" | "ready" | "missing" | "error";

/** Everything the work editor needs: loading, form state, autosave, media actions and deleting. */
export function useEditor(id: number) {
  const [status, setStatus] = useState<EditorStatus>("loading");
  const [title, setTitle] = useState("");
  const [visible, setVisible] = useState(false);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [tags, setTags] = useState<string[]>([]);
  const [coverMediaId, setCoverMediaId] = useState<number | null>(null);
  const [media, setMedia] = useState<Media[]>([]);
  const [defs, setDefs] = useState<FieldDef[]>([]);
  const [allTags, setAllTags] = useState<string[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [editingAlt, setEditingAlt] = useState<number | null>(null);
  const updatedAt = useRef("");

  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    Promise.all([
      api<WorkResponse>("GET", `/api/works/${id}`),
      api<FieldDef[]>("GET", "/api/fields"),
      api<Tag[]>("GET", "/api/tags"),
    ])
      .then(([res, fieldDefs, tagList]) => {
        if (cancelled) return;
        updatedAt.current = res.work.updatedAt;
        setTitle(res.work.title);
        setVisible(res.work.visible);
        setFields(res.work.fields);
        setTags(res.tags.map((t) => t.name));
        setCoverMediaId(res.work.coverMediaId);
        setMedia(res.media);
        setDefs(fieldDefs.filter((d) => !d.archived));
        setAllTags(tagList.map((t) => t.name));
        setStatus("ready");
      })
      .catch((err) => !cancelled && setStatus(err instanceof ApiError && err.status === 404 ? "missing" : "error"));
    return () => {
      cancelled = true;
    };
  }, [id]);

  const { autosave, state } = useAutosave<EditPatch>(async (patch) => {
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
    autosave.queue({ fields: next });
  }
  function changeTags(next: string[]) {
    setTags(next);
    autosave.queue({ tags: next });
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
    status, title, visible, fields, tags, coverMediaId, media, defs, allTags, notice, editingAlt, setEditingAlt,
    saveState: state, retrySave: () => autosave.retry(),
    uploader, uploads,
    changeTitle, changeField, changeTags, changeVisible, changeCover,
    reorderMedia, saveAlt, removeMedia, deleteWork,
  };
}
