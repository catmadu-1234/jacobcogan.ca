import { vi } from "vitest";

export type Call = { method: string; path: string; body: any };

export const json = (status: number, body: unknown) =>
  new Response(body === undefined ? null : JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

/** Replaces fetch; `respond` returns a Response for the calls it knows, or undefined to fall through to 404. */
export function stubFetch(respond: (c: Call) => Response | undefined): Call[] {
  const calls: Call[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (path: string, init: RequestInit = {}) => {
      const call: Call = { method: init.method ?? "GET", path, body: init.body ? JSON.parse(init.body as string) : undefined };
      calls.push(call);
      return respond(call) ?? json(404, { error: "not-found" });
    }),
  );
  return calls;
}
