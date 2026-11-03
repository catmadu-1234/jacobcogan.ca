import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { dismissToast, resetToasts, showToast, toastStore } from "../../src/app/lib/toast";

beforeEach(() => { vi.useFakeTimers(); resetToasts(); });
afterEach(() => vi.useRealTimers());

describe("toasts", () => {
  it("shows one toast at a time and advances after 5 seconds", () => {
    showToast("first");
    showToast("second");
    expect(toastStore.get()?.message).toBe("first");
    vi.advanceTimersByTime(4_999);
    expect(toastStore.get()?.message).toBe("first");
    vi.advanceTimersByTime(1);
    expect(toastStore.get()?.message).toBe("second");
    vi.advanceTimersByTime(5_000);
    expect(toastStore.get()).toBeNull();
  });

  it("carries an action and can be dismissed early", () => {
    const run = vi.fn();
    showToast("Work deleted", { label: "Undo", run });
    const t = toastStore.get()!;
    expect(t.action?.label).toBe("Undo");
    dismissToast(t.id);
    expect(toastStore.get()).toBeNull();
    vi.advanceTimersByTime(10_000);
    expect(toastStore.get()).toBeNull();
  });
});
