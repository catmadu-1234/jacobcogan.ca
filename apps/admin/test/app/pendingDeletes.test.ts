import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createPendingDeletes } from "../../src/app/lib/pendingDeletes";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("createPendingDeletes", () => {
  it("sends a delete once the undo window has passed, and not before", async () => {
    const send = vi.fn().mockResolvedValue(undefined);
    const pending = createPendingDeletes();
    pending.schedule(1, send);
    await vi.advanceTimersByTimeAsync(4_999);
    expect(send).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(send).toHaveBeenCalledExactlyOnceWith(false);
    expect(pending.hasPending()).toBe(false);
  });

  it("never sends a delete that was undone", async () => {
    const send = vi.fn();
    const pending = createPendingDeletes();
    pending.schedule(1, send);
    expect(pending.hasPending()).toBe(true);
    expect(pending.cancel(1)).toBe(true);
    expect(pending.cancel(1)).toBe(false);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(send).not.toHaveBeenCalled();
  });

  it("commits everything immediately, once, in keep-alive mode when asked", async () => {
    const a = vi.fn().mockResolvedValue(undefined);
    const b = vi.fn().mockResolvedValue(undefined);
    const pending = createPendingDeletes();
    pending.schedule("a", a);
    pending.schedule("b", b);
    pending.commitAll(true);
    expect(a).toHaveBeenCalledExactlyOnceWith(true);
    expect(b).toHaveBeenCalledExactlyOnceWith(true);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(a).toHaveBeenCalledTimes(1);
  });

  it("commits pending deletes when the page is being closed, so a removed file cannot stay public", () => {
    const send = vi.fn().mockResolvedValue(undefined);
    const pending = createPendingDeletes();
    const stop = pending.install();
    pending.schedule(1, send);
    window.dispatchEvent(new Event("pagehide"));
    expect(send).toHaveBeenCalledExactlyOnceWith(true);
    stop();
  });

  it("also commits when the page is hidden (phones often skip pagehide), and stops listening once disposed", () => {
    const send = vi.fn().mockResolvedValue(undefined);
    const pending = createPendingDeletes();
    const stop = pending.install();
    pending.schedule(1, send);
    Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true });
    document.dispatchEvent(new Event("visibilitychange"));
    expect(send).toHaveBeenCalledExactlyOnceWith(true);
    stop();
    pending.schedule(2, send);
    window.dispatchEvent(new Event("pagehide"));
    expect(send).toHaveBeenCalledTimes(1);
    Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true });
  });

  it("a failing send does not break the others", async () => {
    const bad = vi.fn().mockRejectedValue(new Error("offline"));
    const good = vi.fn().mockResolvedValue(undefined);
    const pending = createPendingDeletes();
    pending.schedule(1, bad);
    pending.schedule(2, good);
    expect(() => pending.commitAll(true)).not.toThrow();
    expect(good).toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(0);
  });
});
