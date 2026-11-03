import { describe, it, expect } from "vitest";
import { call, seedTwoSites } from "./helpers";

const A = "a@test.dev";
const B = "b@test.dev";
const mk = (label: string) => ({ label, type: "text", required: false });

describe("details (field definitions) API", () => {
  it("creates a detail with a generated key", async () => {
    await seedTwoSites();
    const res = await call(A, "POST", "/api/fields", mk("Medium"));
    expect(res.status).toBe(201);
    expect(await res.json()).toMatchObject({ key: "medium", label: "Medium", type: "text", archived: false });
  });

  it("rejects unknown types and empty labels", async () => {
    await seedTwoSites();
    expect((await call(A, "POST", "/api/fields", { ...mk("X"), type: "html" })).status).toBe(400);
    expect((await call(A, "POST", "/api/fields", mk("   "))).status).toBe(400);
  });

  it("keeps archived details in the list, flagged", async () => {
    await seedTwoSites();
    const d = (await (await call(A, "POST", "/api/fields", mk("Old"))).json()) as any;
    const res = await call(A, "PATCH", `/api/fields/${d.id}`, { archived: true });
    expect(((await res.json()) as any).archived).toBe(true);
    const list = (await (await call(A, "GET", "/api/fields")).json()) as any[];
    expect(list.map((f) => [f.key, f.archived])).toEqual([["old", true]]);
  });

  it("reorders", async () => {
    await seedTwoSites();
    const x = (await (await call(A, "POST", "/api/fields", mk("X"))).json()) as any;
    const y = (await (await call(A, "POST", "/api/fields", mk("Y"))).json()) as any;
    expect((await call(A, "PUT", "/api/fields/order", [y.id, x.id])).status).toBe(204);
    const list = (await (await call(A, "GET", "/api/fields")).json()) as any[];
    expect(list.map((f) => f.key)).toEqual(["y", "x"]);
  });

  it("is isolated per site", async () => {
    await seedTwoSites();
    const d = (await (await call(A, "POST", "/api/fields", mk("Mine"))).json()) as any;
    expect((await call(B, "PATCH", `/api/fields/${d.id}`, { label: "Hacked" })).status).toBe(404);
    expect(((await (await call(B, "GET", "/api/fields")).json()) as any[])).toEqual([]);
  });
});
