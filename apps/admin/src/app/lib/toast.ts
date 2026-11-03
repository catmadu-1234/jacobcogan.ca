import { createStore } from "./store";

export interface Toast {
  id: number;
  message: string;
  action?: { label: string; run: () => void };
}

const DURATION_MS = 5_000;

let queue: Toast[] = [];
let timer: ReturnType<typeof setTimeout> | undefined;
let nextId = 1;

/** The toast currently on screen (or null). Further toasts wait their turn in a queue. */
export const toastStore = createStore<Toast | null>(null);

function advance(): void {
  clearTimeout(timer);
  const next = queue.shift() ?? null;
  toastStore.set(next);
  if (next) timer = setTimeout(advance, DURATION_MS);
}

export function showToast(message: string, action?: Toast["action"]): void {
  queue.push({ id: nextId++, message, action });
  if (!toastStore.get()) advance();
}

export function dismissToast(id: number): void {
  if (toastStore.get()?.id === id) advance();
  else queue = queue.filter((t) => t.id !== id);
}

export function resetToasts(): void {
  clearTimeout(timer);
  queue = [];
  toastStore.set(null);
}
