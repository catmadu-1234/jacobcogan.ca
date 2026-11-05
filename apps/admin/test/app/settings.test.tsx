import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Site } from "@senka/core/types";
import { Settings } from "../../src/app/screens/Settings";
import { meStore } from "../../src/app/lib/me";
import { json, stubFetch, type Call } from "./stub";

const GB = 1024 ** 3;
const site: Site = {
  id: 1, slug: "site-a", name: "Site A", hostname: null, about: "Painter.", links: [],
  theme: { preset: "grotesk", accent: "#141414", rowHeight: 320, showIndexCaptions: false }, contentVersion: 1,
};
const def = (id: number, key: string, label: string, over: object = {}) => ({
  id, siteId: 1, key, label, type: "text", required: false, sort: id, archived: false, ...over,
});
let fields: ReturnType<typeof def>[] = [];

const respond = (c: Call) => {
  if (c.method === "GET" && c.path === "/api/fields") return json(200, fields);
  if (c.method === "PATCH" && c.path === "/api/site") return json(200, { ...site, ...c.body, theme: { ...site.theme, ...(c.body.theme ?? {}) } });
  if (c.method === "POST" && c.path === "/api/fields") {
    const created = def(99, c.body.label.toLowerCase(), c.body.label, { type: c.body.type, required: c.body.required, sort: 99 });
    fields = [...fields, created];
    return json(201, created);
  }
  const patch = /^\/api\/fields\/(\d+)$/.exec(c.path);
  if (c.method === "PATCH" && patch) {
    fields = fields.map((f) => (f.id === Number(patch[1]) ? { ...f, ...c.body } : f));
    return json(200, fields.find((f) => f.id === Number(patch[1])));
  }
  if (c.method === "PUT" && c.path === "/api/fields/order") return json(204, undefined);
  return undefined;
};

function open(storageBytes = 2.1 * GB) {
  meStore.set({ status: "ready", email: "a@test.dev", site, storageBytes });
  return stubFetch(respond);
}

beforeEach(() => {
  fields = [def(1, "medium", "Medium"), def(2, "year", "Year", { required: true }), def(3, "old", "Old", { archived: true })];
});
afterEach(() => vi.unstubAllGlobals());

describe("Settings: storage and site link", () => {
  it("shows storage used out of 10 GB", async () => {
    open(2.1 * GB);
    render(<Settings />);
    expect(await screen.findByText("2.1 GB of 10 GB used")).toBeTruthy();
    const meter = screen.getByRole("meter");
    expect(meter.getAttribute("data-warn")).toBe("false");
  });
  it("turns the meter amber from 80% full", async () => {
    open(8.5 * GB);
    render(<Settings />);
    expect((await screen.findByRole("meter")).getAttribute("data-warn")).toBe("true");
  });
  it("links to the public site", async () => {
    open();
    render(<Settings />);
    const link = (await screen.findByRole("link", { name: /Open my site/ })) as HTMLAnchorElement;
    expect(link.getAttribute("href")).toBe("/site-a");
    expect(link.target).toBe("_blank");
  });
});

describe("Settings: look and about autosave", () => {
  it("saves the chosen style", async () => {
    const calls = open();
    render(<Settings />);
    fireEvent.click(await screen.findByRole("radio", { name: /Atelier/ }));
    await waitFor(() => expect(calls.some((c) => c.method === "PATCH" && c.path === "/api/site")).toBe(true), { timeout: 3000 });
    expect(calls.find((c) => c.path === "/api/site")!.body).toEqual({ theme: { preset: "serif-title" } });
  });

  it("saves a valid accent colour and refuses an invalid one", async () => {
    const calls = open();
    render(<Settings />);
    const hex = await screen.findByLabelText("Accent colour (hex)");
    fireEvent.change(hex, { target: { value: "red" } });
    expect(await screen.findByText("Use a colour like #7A3E2E.")).toBeTruthy();
    fireEvent.change(hex, { target: { value: "#7A3E2E" } });
    await waitFor(() => expect(calls.some((c) => c.path === "/api/site")).toBe(true), { timeout: 3000 });
    expect(calls.filter((c) => c.path === "/api/site")).toHaveLength(1);
    expect(calls.find((c) => c.path === "/api/site")!.body).toEqual({ theme: { accent: "#7A3E2E" } });
  });

  it("saves the bio and name", async () => {
    const calls = open();
    render(<Settings />);
    fireEvent.change(await screen.findByLabelText("Bio"), { target: { value: "I paint." } });
    fireEvent.change(screen.getByLabelText("Your name"), { target: { value: "Jacob Cogan" } });
    await waitFor(() => expect(calls.some((c) => c.path === "/api/site")).toBe(true), { timeout: 3000 });
    expect(calls.find((c) => c.path === "/api/site")!.body).toEqual({ about: "I paint.", name: "Jacob Cogan" });
  });

  it("only saves links once every row is valid", async () => {
    const calls = open();
    render(<Settings />);
    fireEvent.click(await screen.findByRole("button", { name: "Add a link" }));
    fireEvent.change(screen.getByLabelText("Link name 1"), { target: { value: "Instagram" } });
    fireEvent.change(screen.getByLabelText("Link web address 1"), { target: { value: "javascript:alert(1)" } });
    expect(await screen.findByText("The web address must start with http:// or https://.")).toBeTruthy();
    await new Promise((r) => setTimeout(r, 1000));
    expect(calls.some((c) => c.path === "/api/site")).toBe(false);
    fireEvent.change(screen.getByLabelText("Link web address 1"), { target: { value: "https://instagram.com/x" } });
    await waitFor(() => expect(calls.some((c) => c.path === "/api/site")).toBe(true), { timeout: 3000 });
    expect(calls.find((c) => c.path === "/api/site")!.body).toEqual({ links: [{ label: "Instagram", url: "https://instagram.com/x" }] });
  });
});

describe("Settings: details", () => {
  it("lists active details and keeps archived ones apart", async () => {
    open();
    render(<Settings />);
    expect(await screen.findByDisplayValue("Medium")).toBeTruthy();
    expect(screen.getByDisplayValue("Year")).toBeTruthy();
    expect(screen.queryByDisplayValue("Old")).toBeNull();
    expect(screen.getByText("Archived details (1)")).toBeTruthy();
  });

  it("adds a detail", async () => {
    const calls = open();
    render(<Settings />);
    fireEvent.click(await screen.findByRole("button", { name: "Add a detail" }));
    fireEvent.change(screen.getByLabelText("New detail name"), { target: { value: "Dimensions" } });
    fireEvent.change(screen.getByLabelText("New detail type"), { target: { value: "longtext" } });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    expect(await screen.findByDisplayValue("Dimensions")).toBeTruthy();
    expect(calls.find((c) => c.method === "POST")!.body).toEqual({ label: "Dimensions", type: "longtext", required: false });
  });

  it("does not add a detail with no name", async () => {
    open();
    render(<Settings />);
    fireEvent.click(await screen.findByRole("button", { name: "Add a detail" }));
    expect((screen.getByRole("button", { name: "Add" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("renames, changes type, toggles required, archives and restores", async () => {
    const calls = open();
    render(<Settings />);
    const medium = await screen.findByDisplayValue("Medium");
    fireEvent.change(medium, { target: { value: "Technique" } });
    fireEvent.blur(medium);
    await waitFor(() => expect(calls.some((c) => c.body?.label === "Technique")).toBe(true));
    fireEvent.change(screen.getByLabelText("Type of Year"), { target: { value: "url" } });
    await waitFor(() => expect(calls.some((c) => c.path === "/api/fields/2" && c.body.type === "url")).toBe(true));
    const row = screen.getByDisplayValue("Technique").closest("li") as HTMLElement;
    fireEvent.click(within(row).getByRole("switch", { name: "Required" }));
    await waitFor(() => expect(calls.some((c) => c.path === "/api/fields/1" && c.body.required === true)).toBe(true));
    fireEvent.click(screen.getByRole("button", { name: "Archive Technique" }));
    await waitFor(() => expect(screen.queryByDisplayValue("Technique")).toBeNull());
    expect(calls.some((c) => c.path === "/api/fields/1" && c.body.archived === true)).toBe(true);
    fireEvent.click(screen.getByText(/Archived details/));
    fireEvent.click(screen.getByRole("button", { name: "Restore Old" }));
    expect(await screen.findByDisplayValue("Old")).toBeTruthy();
  });

  it("saves a new order when a detail is moved with the keyboard", async () => {
    const calls = open();
    render(<Settings />);
    fireEvent.keyDown(await screen.findByRole("button", { name: /Move Year/ }), { key: "ArrowUp" });
    await waitFor(() => expect(calls.some((c) => c.method === "PUT" && c.path === "/api/fields/order")).toBe(true));
    expect(calls.find((c) => c.method === "PUT")!.body).toEqual([2, 1]);
  });
});
