import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Works } from "../../src/app/screens/Works";

const reply = (routes: Record<string, unknown>) =>
  vi.fn(async (path: string) => {
    const key = Object.keys(routes).find((k) => path.startsWith(k));
    return new Response(JSON.stringify(key ? routes[key] : null), { status: 200, headers: { "content-type": "application/json" } });
  });

const work = (id: number, title: string, visible: boolean) => ({
  id, title, visible, slug: `w-${id}`, sort: id, fields: {}, coverMediaId: null, cover: null, updatedAt: "x", createdAt: "x", deletedAt: null, siteId: 1,
});

afterEach(() => vi.unstubAllGlobals());

describe("Works screen", () => {
  it("shows the friendly empty state with an add button", async () => {
    vi.stubGlobal("fetch", reply({ "/api/works": [], "/api/tags": [] }));
    const onAdd = vi.fn();
    render(<Works onAdd={onAdd} />);
    expect(await screen.findByText(/No works yet\. Add your first piece/)).toBeTruthy();
    screen.getByRole("button", { name: /add your first work/i }).click();
    expect(onAdd).toHaveBeenCalledOnce();
  });

  it("lists works and marks hidden ones", async () => {
    vi.stubGlobal("fetch", reply({ "/api/works": [work(1, "Blue Hour", true), work(2, "Study in Ochre", false)], "/api/tags": [] }));
    render(<Works onAdd={() => {}} />);
    expect(await screen.findByText("Blue Hour")).toBeTruthy();
    expect(screen.getByText("Study in Ochre")).toBeTruthy();
    expect(screen.getAllByText("Hidden")).toHaveLength(1);
  });

  it("shows untitled works with a readable name", async () => {
    vi.stubGlobal("fetch", reply({ "/api/works": [work(3, "", false)], "/api/tags": [] }));
    render(<Works onAdd={() => {}} />);
    expect(await screen.findByText("Untitled")).toBeTruthy();
  });

  it("shows a retry when loading fails", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 500 })));
    render(<Works onAdd={() => {}} />);
    expect(await screen.findByText(/couldn.t load your works/i)).toBeTruthy();
    expect(screen.getByRole("button", { name: /try again/i })).toBeTruthy();
  });
});
