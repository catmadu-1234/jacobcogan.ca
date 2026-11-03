import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, api, reloadOnce, setUnauthenticatedHandler } from "../../src/app/lib/api";

const json = (status: number, body: unknown) =>
  new Response(body === undefined ? null : JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

afterEach(() => vi.unstubAllGlobals());

describe("api", () => {
  it("returns parsed JSON and sends JSON bodies with same-origin credentials", async () => {
    const fetchMock = vi.fn().mockResolvedValue(json(200, { ok: 1 }));
    vi.stubGlobal("fetch", fetchMock);
    expect(await api("POST", "/api/works", { a: 1 })).toEqual({ ok: 1 });
    const [path, init] = fetchMock.mock.calls[0]!;
    expect(path).toBe("/api/works");
    expect(init).toMatchObject({ method: "POST", credentials: "same-origin", body: '{"a":1}' });
    expect(init.headers).toEqual({ "content-type": "application/json" });
  });

  it("returns undefined for 204", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 204 })));
    expect(await api("DELETE", "/api/works/1")).toBeUndefined();
  });

  it("throws ApiError carrying status and body", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json(409, { error: "conflict" })));
    const err = (await api("PATCH", "/api/works/1", {}).catch((e: unknown) => e)) as ApiError;
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(409);
    expect(err.body.error).toBe("conflict");
  });

  it("asks the page to sign in again on 401, then rejects", async () => {
    const handler = vi.fn();
    setUnauthenticatedHandler(handler);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json(401, { error: "unauthenticated" })));
    const err = (await api("GET", "/api/me").catch((e: unknown) => e)) as ApiError;
    expect(handler).toHaveBeenCalledOnce();
    expect(err.status).toBe(401);
  });
});

describe("reloadOnce", () => {
  const memory = () => {
    const data = new Map<string, string>();
    return { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v) };
  };

  it("reloads once, then not again within 10 seconds, so a broken login cannot loop", () => {
    const reload = vi.fn();
    const storage = memory();
    expect(reloadOnce(storage, 1_000, reload)).toBe(true);
    expect(reloadOnce(storage, 5_000, reload)).toBe(false);
    expect(reloadOnce(storage, 12_000, reload)).toBe(true);
    expect(reload).toHaveBeenCalledTimes(2);
  });

  it("still reloads when storage is unavailable", () => {
    const reload = vi.fn();
    expect(reloadOnce(null, 1_000, reload)).toBe(true);
    expect(reload).toHaveBeenCalledOnce();
  });
});
