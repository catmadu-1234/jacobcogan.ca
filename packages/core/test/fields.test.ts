import { env } from "cloudflare:test";
import { describe, it, expect } from "vitest";
import { listFieldDefs, createFieldDef, updateFieldDef, reorderFieldDefs } from "../src";
import { seedTwoSites } from "./fixtures";

const input = (label: string) => ({ label, type: "text" as const, required: false });

describe("field defs", () => {
  it("de-duplicates keys with numeric suffixes", async () => {
    const { a } = await seedTwoSites(env.DB);
    const one = await createFieldDef(env.DB, a, input("Medium"));
    const two = await createFieldDef(env.DB, a, input("Medium"));
    expect([one.key, two.key]).toEqual(["medium", "medium-2"]);
  });
  it("reorders", async () => {
    const { a } = await seedTwoSites(env.DB);
    const x = await createFieldDef(env.DB, a, input("X"));
    const y = await createFieldDef(env.DB, a, input("Y"));
    await reorderFieldDefs(env.DB, a, [y.id, x.id]);
    expect((await listFieldDefs(env.DB, a)).map((f) => f.key)).toEqual(["y", "x"]);
  });
  it("excludes archived by default and includes them on request", async () => {
    const { a } = await seedTwoSites(env.DB);
    const x = await createFieldDef(env.DB, a, input("X"));
    await updateFieldDef(env.DB, a, x.id, { archived: true });
    expect(await listFieldDefs(env.DB, a)).toEqual([]);
    expect(await listFieldDefs(env.DB, a, { includeArchived: true })).toHaveLength(1);
  });
  it("does not touch another site's defs", async () => {
    const { a, b } = await seedTwoSites(env.DB);
    const x = await createFieldDef(env.DB, a, input("X"));
    expect(await updateFieldDef(env.DB, b, x.id, { label: "Hacked" })).toBeNull();
    expect((await listFieldDefs(env.DB, a))[0]!.label).toBe("X");
  });
});
