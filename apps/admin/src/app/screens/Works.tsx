import { useState, type KeyboardEvent, type PointerEvent } from "react";
import { Images, Search } from "lucide-react";
import { api } from "../lib/api";
import { moveItem } from "../lib/reorder";
import { showToast } from "../lib/toast";
import { useWorks, type WorkSummary } from "../lib/useWorks";
import { Button } from "../components/Button";
import { EmptyState } from "../components/EmptyState";
import { WorkCard } from "../components/WorkCard";
import styles from "./Works.module.css";

interface Props {
  onAdd: () => void;
}

export function Works({ onAdd }: Props) {
  const { query, setQuery, tag, setTag, works, setWorks, tags, state, reload } = useWorks();
  const [order, setOrder] = useState<WorkSummary[] | null>(null);
  const [dragId, setDragId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  const reordering = order !== null;
  const shown = order ?? works;
  const filtered = query.trim() !== "" || tag !== "";

  function move(id: number, toIndex: number) {
    setOrder((current) => {
      if (!current) return current;
      return moveItem(current, current.findIndex((w) => w.id === id), toIndex);
    });
  }

  function onPointerMove(e: PointerEvent<HTMLButtonElement>) {
    if (dragId === null || !order) return;
    const over = document.elementFromPoint(e.clientX, e.clientY)?.closest<HTMLElement>("[data-work-id]");
    const overId = over ? Number(over.dataset.workId) : null;
    if (overId !== null && overId !== dragId) move(dragId, order.findIndex((w) => w.id === overId));
  }

  function onKeyDown(id: number, e: KeyboardEvent<HTMLButtonElement>) {
    if (!order) return;
    const from = order.findIndex((w) => w.id === id);
    const step = e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : 0;
    if (!step) return;
    e.preventDefault();
    move(id, from + step);
  }

  async function finishReorder() {
    if (!order) return;
    setSaving(true);
    try {
      await api("PUT", "/api/works/order", order.map((w) => w.id));
      setWorks(order);
      setOrder(null);
    } catch {
      showToast("Couldn't save the new order. Try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={styles.page}>
      <header className={styles.heading}>
        <div>
          <p className={styles.eyebrow}>YOUR PORTFOLIO</p>
          <h1 className={styles.title}>Works</h1>
          <p className={styles.lede}>Collect, arrange, and share your work.</p>
        </div>
        {reordering ? (
          <Button onClick={finishReorder} busy={saving}>
            Done
          </Button>
        ) : works.length > 1 && !filtered ? (
          <Button variant="secondary" onClick={() => setOrder(works)}>
            Reorder
          </Button>
        ) : null}
      </header>

      {reordering ? null : (
        <div className={styles.filters}>
          <label className={styles.search}>
            <Search size={18} aria-hidden="true" />
            <input
              type="search"
              placeholder="Search works"
              aria-label="Search works"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
          <select aria-label="Filter by tag" value={tag} onChange={(e) => setTag(e.target.value)}>
            <option value="">All tags</option>
            {tags.map((t) => (
              <option key={t.id} value={t.slug}>
                {t.name}
              </option>
            ))}
          </select>
          <span className={styles.count}>
            {state === "ready" ? `${works.length} ${works.length === 1 ? "work" : "works"}` : ""}
          </span>
        </div>
      )}

      {state === "error" ? (
        <EmptyState
          icon={<Images size={28} />}
          text="We couldn't load your works."
          actionLabel="Try again"
          onAction={reload}
        />
      ) : state === "loading" && works.length === 0 ? (
        <div className={styles.grid} aria-busy="true" aria-label="Loading works">
          <div className={styles.skeleton} />
          <div className={styles.skeleton} />
          <div className={styles.skeleton} />
          <div className={styles.skeleton} />
        </div>
      ) : shown.length === 0 ? (
        filtered ? (
          <EmptyState icon={<Search size={28} />} text="No works match that search." />
        ) : (
          <EmptyState
            icon={<Images size={28} />}
            title="Make room for your work."
            text="No works yet. Add your first piece — a photo from your phone is fine."
            actionLabel="Add your first work"
            onAction={onAdd}
          />
        )
      ) : (
        <div className={styles.grid}>
          {shown.map((w) => (
            <WorkCard
              key={w.id}
              work={w}
              reordering={reordering}
              dragging={dragId === w.id}
              onHandlePointerDown={(e) => {
                e.currentTarget.setPointerCapture(e.pointerId);
                setDragId(w.id);
              }}
              onHandlePointerMove={onPointerMove}
              onHandlePointerEnd={() => setDragId(null)}
              onHandleKeyDown={(e) => onKeyDown(w.id, e)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
