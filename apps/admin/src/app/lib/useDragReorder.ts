import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { moveItem } from "./reorder";

/**
 * Drag (pointer) and keyboard reordering for a list of items with numeric ids. Give each item's drag handle
 * `handlers(id)` and each item's element a `data-reorder-id`; `onCommit` receives the new id order.
 *
 * While dragging, movement is tracked on `window` rather than on the handle: reordering moves the dragged
 * element in the DOM, and browsers drop pointer capture when that happens, which would strand the drag.
 */
export function useDragReorder<T extends { id: number }>(items: T[], onCommit: (ids: number[]) => void) {
  const [live, setLive] = useState<T[] | null>(null);
  const [dragId, setDragId] = useState<number | null>(null);
  const liveRef = useRef<T[] | null>(null);
  const itemsRef = useRef(items);
  itemsRef.current = items;
  const commitRef = useRef(onCommit);
  commitRef.current = onCommit;
  const stopRef = useRef<(() => void) | null>(null);

  useEffect(() => () => stopRef.current?.(), []);

  const setBoth = (next: T[] | null) => {
    liveRef.current = next;
    setLive(next);
  };
  const same = (a: T[], b: T[]) => a.length === b.length && a.every((x, i) => x.id === b[i]!.id);

  function begin(id: number) {
    stopRef.current?.();
    setBoth(itemsRef.current);
    setDragId(id);

    const onMove = (e: globalThis.PointerEvent) => {
      const current = liveRef.current;
      if (!current) return;
      const over = document.elementFromPoint(e.clientX, e.clientY)?.closest<HTMLElement>("[data-reorder-id]");
      const overId = over ? Number(over.dataset.reorderId) : null;
      if (overId === null || overId === id) return;
      setBoth(moveItem(current, current.findIndex((x) => x.id === id), current.findIndex((x) => x.id === overId)));
    };
    const finish = (commit: boolean) => {
      stop();
      const final = liveRef.current;
      setDragId(null);
      setBoth(null);
      if (commit && final && !same(final, itemsRef.current)) commitRef.current(final.map((x) => x.id));
    };
    const onUp = () => finish(true);
    const onCancel = () => finish(false);
    const stop = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onCancel);
      stopRef.current = null;
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onCancel);
    stopRef.current = stop;
  }

  function handlers(id: number) {
    return {
      onPointerDown(_e: PointerEvent<HTMLButtonElement>) {
        begin(id);
      },
      onKeyDown(e: KeyboardEvent<HTMLButtonElement>) {
        const step = e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : 0;
        if (!step) return;
        e.preventDefault();
        const list = itemsRef.current;
        const from = list.findIndex((x) => x.id === id);
        const next = moveItem(list, from, from + step);
        if (!same(next, list)) commitRef.current(next.map((x) => x.id));
      },
    };
  }

  return { shown: live ?? items, dragId, handlers };
}
