import { describe, expect, it, vi } from "vitest";
import { createStore } from "../../src/app/lib/store";

describe("createStore", () => {
  it("gets, sets and applies functional updates", () => {
    const s = createStore(1);
    s.set(2);
    s.set((n) => n + 5);
    expect(s.get()).toBe(7);
  });
  it("notifies subscribers on change and stops after unsubscribe", () => {
    const s = createStore("a");
    const fn = vi.fn();
    const off = s.subscribe(fn);
    s.set("b");
    expect(fn).toHaveBeenCalledTimes(1);
    off();
    s.set("c");
    expect(fn).toHaveBeenCalledTimes(1);
  });
  it("does not notify when the value is unchanged", () => {
    const s = createStore(1);
    const fn = vi.fn();
    s.subscribe(fn);
    s.set(1);
    expect(fn).not.toHaveBeenCalled();
  });
});
