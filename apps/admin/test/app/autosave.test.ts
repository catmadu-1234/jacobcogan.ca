import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../../src/app/lib/api";
import { createAutosave } from "../../src/app/lib/autosave";

type P = { title?: string; fields?: Record<string, string>; visible?: boolean };

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

const flushPromises = () => vi.advanceTimersByTimeAsync(0);

describe("createAutosave", () => {
  it("merges patches queued within the delay into one save", async () => {
    const save = vi.fn<(p: P) => Promise<void>>().mockResolvedValue();
    const auto = createAutosave<P>(save);
    auto.queue({ title: "a" });
    await vi.advanceTimersByTimeAsync(400);
    auto.queue({ fields: { m: "x" } });
    await vi.advanceTimersByTimeAsync(799);
    expect(save).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith({ title: "a", fields: { m: "x" } });
  });

  it("goes saved -> saving -> saved", async () => {
    const auto = createAutosave<P>(vi.fn().mockResolvedValue(undefined));
    expect(auto.state.get()).toBe("saved");
    auto.queue({ title: "a" });
    expect(auto.state.get()).toBe("saving");
    await vi.advanceTimersByTimeAsync(800);
    expect(auto.state.get()).toBe("saved");
  });

  it("flush sends immediately", async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const auto = createAutosave<P>(save);
    auto.queue({ title: "a" });
    await auto.flush();
    expect(save).toHaveBeenCalledOnce();
    expect(auto.hasUnsaved()).toBe(false);
  });

  it("sends changes made during a save afterwards, without repeating the earlier ones", async () => {
    let release!: () => void;
    const save = vi.fn<(p: P) => Promise<void>>()
      .mockImplementationOnce(() => new Promise<void>((r) => (release = r)))
      .mockResolvedValue();
    const auto = createAutosave<P>(save);
    auto.queue({ title: "a" });
    await vi.advanceTimersByTimeAsync(800);
    auto.queue({ visible: true });
    release();
    await vi.advanceTimersByTimeAsync(800);
    expect(save).toHaveBeenCalledTimes(2);
    expect(save.mock.calls[1]![0]).toEqual({ visible: true });
  });

  it("reports a conflict on 409 and stops sending", async () => {
    const save = vi.fn().mockRejectedValue(new ApiError(409, { error: "conflict" }));
    const auto = createAutosave<P>(save);
    auto.queue({ title: "a" });
    await vi.advanceTimersByTimeAsync(800);
    expect(auto.state.get()).toBe("conflict");
    auto.queue({ title: "b" });
    await vi.advanceTimersByTimeAsync(5000);
    expect(save).toHaveBeenCalledTimes(1);
  });

  it("goes offline on a network failure and retries when the browser is back online", async () => {
    const save = vi.fn<(p: P) => Promise<void>>()
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValue();
    const auto = createAutosave<P>(save);
    auto.queue({ title: "a" });
    await vi.advanceTimersByTimeAsync(800);
    expect(auto.state.get()).toBe("offline");
    window.dispatchEvent(new Event("online"));
    await flushPromises();
    expect(auto.state.get()).toBe("saved");
    expect(save).toHaveBeenLastCalledWith({ title: "a" });
  });

  it("keeps a failed patch and merges newer edits into it on retry", async () => {
    const save = vi.fn<(p: P) => Promise<void>>()
      .mockRejectedValueOnce(new ApiError(500, null))
      .mockResolvedValue();
    const auto = createAutosave<P>(save);
    auto.queue({ title: "old", visible: true });
    await vi.advanceTimersByTimeAsync(800);
    expect(auto.state.get()).toBe("error");
    expect(auto.hasUnsaved()).toBe(true);
    auto.queue({ title: "new" });
    auto.retry();
    await flushPromises();
    expect(save).toHaveBeenLastCalledWith({ title: "new", visible: true });
    expect(auto.state.get()).toBe("saved");
  });
});
