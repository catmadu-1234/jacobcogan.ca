import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Tags } from "../../src/app/screens/Tags";
import { Toast } from "../../src/app/components/Toast";
import { resetToasts } from "../../src/app/lib/toast";
import { json, stubFetch, type Call } from "./stub";

const tag = (id: number, name: string, count: number) => ({ id, siteId: 1, name, slug: name.toLowerCase(), count });
let list = [tag(1, "Oil", 2), tag(2, "Paper", 1)];

const respond = (c: Call) => {
  if (c.method === "GET" && c.path === "/api/tags") return json(200, list);
  if (c.method === "PATCH" && c.path === "/api/tags/2") {
    const next = c.body.name.toLowerCase() === "oil" ? list[0]! : { ...list[1]!, name: c.body.name };
    list = c.body.name.toLowerCase() === "oil" ? [{ ...list[0]!, count: 3 }] : [list[0]!, next];
    return json(200, next);
  }
  if (c.method === "DELETE") return json(204, undefined);
  return undefined;
};

const ui = () => (
  <>
    <Tags />
    <Toast />
  </>
);

beforeEach(() => {
  resetToasts();
  list = [tag(1, "Oil", 2), tag(2, "Paper", 1)];
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("Tags screen", () => {
  it("lists tags with how many works use each", async () => {
    stubFetch(respond);
    render(ui());
    expect(await screen.findByRole("button", { name: "Rename Oil" })).toBeTruthy();
    expect(screen.getByText("2 works")).toBeTruthy();
    expect(screen.getByText("1 work")).toBeTruthy();
  });

  it("explains an empty list", async () => {
    list = [];
    stubFetch(respond);
    render(ui());
    expect(await screen.findByText(/No tags yet\. Tags you add to works show up here\./)).toBeTruthy();
  });

  it("renames in place when Enter is pressed and cancels with Escape", async () => {
    const calls = stubFetch(respond);
    render(ui());
    fireEvent.click(await screen.findByRole("button", { name: "Rename Paper" }));
    const input = screen.getByLabelText("New name for Paper");
    fireEvent.keyDown(input, { key: "Escape" });
    expect(screen.queryByLabelText("New name for Paper")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Rename Paper" }));
    fireEvent.change(screen.getByLabelText("New name for Paper"), { target: { value: "Drawing" } });
    fireEvent.keyDown(screen.getByLabelText("New name for Paper"), { key: "Enter" });
    expect(await screen.findByRole("button", { name: "Rename Drawing" })).toBeTruthy();
    expect(calls.filter((c) => c.method === "PATCH")).toHaveLength(1);
    expect(calls.find((c) => c.method === "PATCH")!.body).toEqual({ name: "Drawing" });
  });

  it("asks before merging when the new name is an existing tag, and merges on confirm", async () => {
    const calls = stubFetch(respond);
    render(ui());
    fireEvent.click(await screen.findByRole("button", { name: "Rename Paper" }));
    fireEvent.change(screen.getByLabelText("New name for Paper"), { target: { value: "oil" } });
    fireEvent.keyDown(screen.getByLabelText("New name for Paper"), { key: "Enter" });
    expect(await screen.findByText("Merge ‘Paper’ into ‘Oil’? Works tagged Paper will be tagged Oil.")).toBeTruthy();
    expect(calls.some((c) => c.method === "PATCH")).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "Merge" }));
    await waitFor(() => expect(calls.some((c) => c.method === "PATCH")).toBe(true));
    expect(await screen.findByText("3 works")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Rename Paper" })).toBeNull();
  });

  it("cancels a merge without changing anything", async () => {
    const calls = stubFetch(respond);
    render(ui());
    fireEvent.click(await screen.findByRole("button", { name: "Rename Paper" }));
    fireEvent.change(screen.getByLabelText("New name for Paper"), { target: { value: "Oil" } });
    fireEvent.keyDown(screen.getByLabelText("New name for Paper"), { key: "Enter" });
    fireEvent.click(await screen.findByRole("button", { name: "Cancel" }));
    expect(screen.getByRole("button", { name: "Rename Paper" })).toBeTruthy();
    expect(calls.some((c) => c.method === "PATCH")).toBe(false);
  });

  it("deletes with an undo, and only tells the server when the undo window closes", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const calls = stubFetch(respond);
    render(ui());
    fireEvent.click(await screen.findByRole("button", { name: "Delete Oil" }));
    expect(screen.queryByRole("button", { name: "Rename Oil" })).toBeNull();
    expect(await screen.findByText("Tag deleted")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(await screen.findByRole("button", { name: "Rename Oil" })).toBeTruthy();
    await act(async () => void vi.advanceTimersByTime(6000));
    expect(calls.some((c) => c.method === "DELETE")).toBe(false);

    fireEvent.click(screen.getByRole("button", { name: "Delete Oil" }));
    await act(async () => void vi.advanceTimersByTime(5000));
    await waitFor(() => expect(calls.some((c) => c.method === "DELETE" && c.path === "/api/tags/1")).toBe(true));
  });

  it("deletes immediately on the server when leaving the screen during the undo window", async () => {
    const calls = stubFetch(respond);
    const { unmount } = render(ui());
    fireEvent.click(await screen.findByRole("button", { name: "Delete Oil" }));
    unmount();
    expect(calls.some((c) => c.method === "DELETE" && c.path === "/api/tags/1")).toBe(true);
  });
});
