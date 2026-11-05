import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api as realApi } from "../../src/app/lib/api";
import { Editor } from "../../src/app/screens/Editor";
import { Toast } from "../../src/app/components/Toast";
import { resetToasts } from "../../src/app/lib/toast";

const hoisted = vi.hoisted(() => ({ prepare: null as null | ((...args: unknown[]) => Promise<unknown>) }));

vi.mock("../../src/app/lib/upload/uploader", async (importOriginal) => {
  const mod = await importOriginal<typeof import("../../src/app/lib/upload/uploader")>();
  const { api } = await import("../../src/app/lib/api");
  return {
    ...mod,
    createUploader: (workId: number, onDone: Parameters<typeof mod.createUploader>[1]) =>
      mod.createUploader(workId, onDone, {
        prepare: (...args) => hoisted.prepare!(...args) as never,
        api,
        putBlob: async (_path, _blob, onProgress) => onProgress(1),
        previewUrl: () => "blob:preview",
      }),
  };
});

const work = (over: object = {}) => ({
  id: 5, siteId: 1, slug: "untitled-5", title: "", visible: false, sort: 0, fields: {}, coverMediaId: null,
  createdAt: "t0", updatedAt: "t1", deletedAt: null, ...over,
});
const media = (id: number, alt: string) => ({
  id, siteId: 1, workId: 5, kind: "image", status: "ready", mime: "image/jpeg", width: 1, height: 1, duration: null,
  color: null, alt, variants: ["original", "w480"], bytes: 1, sort: id, createdAt: "",
});
const emptyFacets = { medium: [], project: [], content: [], exhibition: [] };
const requiredDef = { id: 1, siteId: 1, key: "availability", label: "Availability", type: "text", required: true, sort: 1, archived: false };
const yearDef = { id: 2, siteId: 1, key: "year", label: "Year", type: "text", required: false, sort: 2, archived: false };

type Call = { method: string; path: string; body: any };
const json = (status: number, body: unknown) =>
  new Response(body === undefined ? null : JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

function stubApi(respond: (c: Call) => Response | undefined, load: { work?: object; media?: object[]; facets?: object } = {}) {
  const calls: Call[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (path: string, init: RequestInit = {}) => {
      const call: Call = { method: init.method ?? "GET", path, body: init.body ? JSON.parse(init.body as string) : undefined };
      calls.push(call);
      const custom = respond(call);
      if (custom) return custom;
      if (call.method === "GET" && path === "/api/works/5") return json(200, { work: load.work ?? work(), media: load.media ?? [], facets: load.facets ?? emptyFacets });
      if (call.method === "GET" && path === "/api/fields") return json(200, [requiredDef, yearDef]);
      if (call.method === "GET" && path === "/api/facets") return json(200, { ...emptyFacets, medium: [{ id: 1, name: "Oil" }, { id: 2, name: "Paper" }] });
      return json(404, { error: "not-found" });
    }),
  );
  return calls;
}

const ui = () => (
  <>
    <Editor id={5} />
    <Toast />
  </>
);

beforeEach(() => resetToasts());
afterEach(() => vi.unstubAllGlobals());

describe("Editor", () => {
  it("shows the title, catalogue, details and visibility of the work", async () => {
    stubApi(() => undefined, {
      work: work({ title: "Blue Hour", fields: { availability: "Sold", year: "2024" } }),
      facets: { ...emptyFacets, medium: [{ id: 1, name: "Oil" }, { id: 3, name: "Paper" }], content: [{ id: 4, name: "Dogs" }] },
    });
    render(ui());
    expect(((await screen.findByLabelText("Title")) as HTMLInputElement).value).toBe("Blue Hour");
    expect((screen.getByLabelText(/Availability/) as HTMLInputElement).value).toBe("Sold");
    expect((screen.getByLabelText("Year") as HTMLInputElement).value).toBe("2024");
    expect(screen.getByRole("button", { name: "Remove medium Oil" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Remove medium Paper" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Remove content Dogs" })).toBeTruthy();
    expect(screen.getByRole("switch", { name: /visible on site/i }).getAttribute("aria-checked")).toBe("false");
  });

  it("autosaves edits after a pause, sending the version it loaded", async () => {
    const calls = stubApi((c) => (c.method === "PATCH" ? json(200, { work: work({ title: "New", updatedAt: "t2" }), facets: emptyFacets }) : undefined));
    render(ui());
    fireEvent.change(await screen.findByLabelText("Title"), { target: { value: "New" } });
    await waitFor(() => expect(calls.some((c) => c.method === "PATCH")).toBe(true), { timeout: 3000 });
    expect(calls.find((c) => c.method === "PATCH")).toMatchObject({ path: "/api/works/5", body: { title: "New", expectedUpdatedAt: "t1" } });
    expect(await screen.findByText("Saved")).toBeTruthy();
  });

  it("keeps the work hidden and says why when a required detail is empty", async () => {
    let patches = 0;
    const calls = stubApi((c) => {
      if (c.method !== "PATCH") return undefined;
      return ++patches === 1
        ? json(400, { error: "missing-required", missing: ["Availability"] })
        : json(200, { work: work({ updatedAt: "t2" }), facets: emptyFacets });
    });
    render(ui());
    const toggle = await screen.findByRole("switch", { name: /visible on site/i });
    fireEvent.click(toggle);
    expect(await screen.findByText(/Hidden for now\. Fill in Availability to show this work on your site\./, undefined, { timeout: 3000 })).toBeTruthy();
    expect(toggle.getAttribute("aria-checked")).toBe("false");
    const sent = calls.filter((c) => c.method === "PATCH");
    expect(sent[1]!.body).toMatchObject({ visible: false, expectedUpdatedAt: "t1" });
    expect(screen.getByText("Needed to show this work on your site.")).toBeTruthy();
  });

  it("explains each catalogue field behind an i button", async () => {
    stubApi(() => undefined);
    render(ui());
    fireEvent.click(await screen.findByRole("button", { name: "About Exhibition" }));
    expect(screen.getByRole("note").textContent).toMatch(/shows it has hung in/i);
    fireEvent.click(screen.getByRole("button", { name: "About Year" }));
    expect(screen.getAllByRole("note").some((n) => /four digits/i.test(n.textContent ?? ""))).toBe(true);
  });

  it("shows the explanation on hover, then hides it again", async () => {
    stubApi(() => undefined);
    render(ui());
    const button = await screen.findByRole("button", { name: "About Medium" });
    expect(screen.queryByRole("note")).toBeNull();
    fireEvent.mouseEnter(button.parentElement!);
    expect(screen.getByRole("note").textContent).toMatch(/made of/i);
    fireEvent.mouseLeave(button.parentElement!);
    expect(screen.queryByRole("note")).toBeNull();
  });

  it("saves several values for a facet together with the other facets", async () => {
    const calls = stubApi((c) => (c.method === "PATCH" ? json(200, { work: work({ updatedAt: "t2" }), facets: emptyFacets }) : undefined), {
      facets: { ...emptyFacets, project: [{ id: 9, name: "Harbour" }] },
    });
    render(ui());
    const box = await screen.findByLabelText("Add a medium");
    fireEvent.change(box, { target: { value: "Oil" } });
    fireEvent.keyDown(box, { key: "Enter" });
    fireEvent.change(box, { target: { value: "Paper" } });
    fireEvent.keyDown(box, { key: "Enter" });
    await waitFor(() => expect(calls.some((c) => c.method === "PATCH")).toBe(true), { timeout: 3000 });
    expect(calls.find((c) => c.method === "PATCH")!.body.facets).toEqual({ medium: ["Oil", "Paper"], project: ["Harbour"], content: [], exhibition: [] });
  });

  it("will not send a year that is not four digits, and says so", async () => {
    const calls = stubApi(() => undefined);
    render(ui());
    fireEvent.change(await screen.findByLabelText("Year"), { target: { value: "24" } });
    expect(await screen.findByText(/Use four digits, like 2024/)).toBeTruthy();
    await new Promise((r) => setTimeout(r, 1200));
    expect(calls.some((c) => c.method === "PATCH")).toBe(false);
  });

  it("warns when the work was changed somewhere else", async () => {
    stubApi((c) => (c.method === "PATCH" ? json(409, { error: "conflict", work: work() }) : undefined));
    render(ui());
    fireEvent.change(await screen.findByLabelText("Title"), { target: { value: "x" } });
    expect(await screen.findByText(/changed in another tab/, undefined, { timeout: 3000 })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Reload" })).toBeTruthy();
  });

  it("explains when the work no longer exists", async () => {
    stubApi((c) => (c.path === "/api/works/5" ? json(404, { error: "not-found" }) : undefined));
    render(ui());
    expect(await screen.findByText(/couldn't find that work/i)).toBeTruthy();
  });

  it("removes a file with an undo, without touching the server until the undo window closes", async () => {
    const calls = stubApi(() => undefined, { media: [media(1, "Sunrise")] });
    render(ui());
    fireEvent.click(await screen.findByRole("button", { name: "More actions for Sunrise" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Remove" }));
    expect(screen.queryByRole("button", { name: "More actions for Sunrise" })).toBeNull();
    expect(await screen.findByText("File removed")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(await screen.findByRole("button", { name: "More actions for Sunrise" })).toBeTruthy();
    expect(calls.some((c) => c.method === "DELETE")).toBe(false);
  });

  it("reorders media with the keyboard and saves the new order", async () => {
    const calls = stubApi((c) => (c.method === "PUT" ? json(204, undefined) : undefined), { media: [media(1, "First"), media(2, "Second")] });
    render(ui());
    const handle = await screen.findByRole("button", { name: /Move Second/ });
    fireEvent.keyDown(handle, { key: "ArrowLeft" });
    await waitFor(() => expect(calls.some((c) => c.method === "PUT")).toBe(true));
    expect(calls.find((c) => c.method === "PUT")).toMatchObject({ path: "/api/works/5/media/order", body: [2, 1] });
  });

  it("deletes a work, then offers undo", async () => {
    const calls = stubApi((c) => (c.method === "DELETE" ? json(204, undefined) : undefined));
    render(ui());
    fireEvent.click(await screen.findByRole("button", { name: "Delete work" }));
    expect(await screen.findByText("Work deleted")).toBeTruthy();
    expect(calls.some((c) => c.method === "DELETE" && c.path === "/api/works/5")).toBe(true);
  });

  it("keeps the format warning visible after an HEVC video finishes uploading, until dismissed", async () => {
    hoisted.prepare = async () => ({
      kind: "video", mime: "video/quicktime", width: 1280, height: 720, duration: 2, color: "#aabbcc", hevc: true,
      blobs: [{ variant: "original", blob: new Blob(["v"]) }, { variant: "poster", blob: new Blob(["p"]) }],
    });
    stubApi((c) => {
      if (c.method === "POST" && c.path === "/api/works/5/media") return json(201, { ...media(9, ""), kind: "video", status: "pending", variants: ["original", "poster"] });
      if (c.method === "PATCH" && c.path === "/api/media/9") return json(200, { ...media(9, ""), kind: "video", variants: ["original", "poster"] });
      return undefined;
    });
    const { container } = render(ui());
    await screen.findByLabelText("Title");
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [new File(["x"], "clip.mov", { type: "video/quicktime" })] } });
    const warning = await screen.findByText(/clip\.mov: This video uses a format some browsers can't play/, undefined, { timeout: 3000 });
    expect(warning).toBeTruthy();
    expect(screen.getByRole("button", { name: /More actions for video/ })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Got it" }));
    expect(screen.queryByText(/This video uses a format/)).toBeNull();
  });
});
