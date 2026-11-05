import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CatalogueSection } from "../../src/app/screens/settings/CatalogueSection";

const value = (id: number, facet: string, name: string, slug: string, count: number) => ({ id, siteId: 1, facet, name, slug, count });
const json = (status: number, body: unknown) =>
  new Response(body === undefined ? null : JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

function stub() {
  const calls: { method: string; path: string; body: any }[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (path: string, init: RequestInit = {}) => {
      calls.push({ method: init.method ?? "GET", path, body: init.body ? JSON.parse(init.body as string) : undefined });
      if ((init.method ?? "GET") === "PATCH") return json(200, {});
      return json(200, {
        medium: [value(1, "medium", "Oli", "oli", 2), value(2, "medium", "Oil", "oil", 1)],
        project: [], content: [value(3, "content", "Dogs", "dogs", 1)], exhibition: [],
      });
    }),
  );
  return calls;
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("CatalogueSection", () => {
  it("lists the values in use per facet, with how many works have each", async () => {
    stub();
    render(<CatalogueSection />);
    expect(await screen.findByText("Oli")).toBeTruthy();
    expect(screen.getByText("2 works")).toBeTruthy();
    expect(screen.getByText("Dogs")).toBeTruthy();
    expect(screen.queryByText("Project")).toBeNull();
  });

  it("renames a value everywhere with one request", async () => {
    const calls = stub();
    render(<CatalogueSection />);
    fireEvent.click(await screen.findByRole("button", { name: "Rename Dogs" }));
    const input = screen.getByLabelText("New name for Dogs");
    fireEvent.change(input, { target: { value: "Hounds" } });
    fireEvent.keyDown(input, { key: "Enter" });
    await waitFor(() => expect(calls.some((c) => c.method === "PATCH")).toBe(true));
    expect(calls.find((c) => c.method === "PATCH")).toMatchObject({ path: "/api/facets/3", body: { name: "Hounds" } });
  });

  it("asks before merging into a value that already exists", async () => {
    const calls = stub();
    render(<CatalogueSection />);
    fireEvent.click(await screen.findByRole("button", { name: "Rename Oli" }));
    const input = screen.getByLabelText("New name for Oli");
    fireEvent.change(input, { target: { value: "oil" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(await screen.findByText(/Merge ‘Oli’ into ‘Oil’/)).toBeTruthy();
    expect(calls.some((c) => c.method === "PATCH")).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "Merge" }));
    await waitFor(() => expect(calls.some((c) => c.method === "PATCH")).toBe(true));
  });
});
