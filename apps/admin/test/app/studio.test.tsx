import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Studio } from "../../src/app/screens/Studio";
import { json, stubFetch } from "./stub";

const post = (id: number, body: string, visible = true) => ({
  id, body, visible, kind: "post", title: "", slug: `p-${id}`, sort: id, fields: {}, coverMediaId: null,
  updatedAt: `u${id}`, createdAt: "2026-11-04T18:30:00.000Z", deletedAt: null, siteId: 1, media: [],
});

afterEach(() => vi.unstubAllGlobals());

describe("Studio screen", () => {
  it("invites the first post when the feed is empty", async () => {
    stubFetch((c) => (c.path === "/api/studio" ? json(200, []) : undefined));
    render(<Studio />);
    expect(await screen.findByText("Nothing in the Studio yet.")).toBeTruthy();
    expect((screen.getByRole("button", { name: "Post" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("lists posts with their words and whether they show on the site", async () => {
    stubFetch((c) => (c.path === "/api/studio" ? json(200, [post(2, "Second", true), post(1, "First", false)]) : undefined));
    render(<Studio />);
    expect(await screen.findByDisplayValue("Second")).toBeTruthy();
    expect(screen.getByText("Visible on site")).toBeTruthy();
    expect(screen.getByText("Hidden")).toBeTruthy();
  });

  it("posts a thought from the box and reloads the feed", async () => {
    let created = false;
    const calls = stubFetch((c) => {
      if (c.method === "GET" && c.path === "/api/studio") return json(200, created ? [post(9, "Work slowly.")] : []);
      if (c.method === "POST" && c.path === "/api/studio") return json(201, post(9, ""));
      if (c.method === "PATCH" && c.path === "/api/works/9") {
        created = true;
        return json(200, { work: post(9, "Work slowly.") });
      }
      return undefined;
    });
    render(<Studio />);
    await screen.findByText("Nothing in the Studio yet.");
    fireEvent.change(screen.getByLabelText("Words for this post"), { target: { value: "Work slowly." } });
    fireEvent.click(screen.getByRole("button", { name: "Post" }));
    expect(await screen.findByDisplayValue("Work slowly.")).toBeTruthy();
    expect(calls.find((c) => c.method === "PATCH")?.body).toMatchObject({ body: "Work slowly.", visible: true });
  });

  it("hides a post when its switch is turned off", async () => {
    const calls = stubFetch((c) => {
      if (c.path === "/api/studio") return json(200, [post(3, "Shown", true)]);
      if (c.method === "PATCH") return json(200, { work: post(3, "Shown", false) });
      return undefined;
    });
    render(<Studio />);
    fireEvent.click(await screen.findByRole("switch"));
    await waitFor(() => expect(calls.find((c) => c.method === "PATCH")?.body).toMatchObject({ visible: false, expectedUpdatedAt: "u3" }));
  });

  it("deletes a post and offers Undo", async () => {
    const calls = stubFetch((c) => {
      if (c.method === "GET") return json(200, [post(4, "Bye")]);
      if (c.method === "DELETE") return new Response(null, { status: 204 });
      return undefined;
    });
    render(<Studio />);
    fireEvent.click(await screen.findByRole("button", { name: "Delete post" }));
    await waitFor(() => expect(screen.queryByDisplayValue("Bye")).toBeNull());
    expect(calls.some((c) => c.method === "DELETE" && c.path === "/api/works/4")).toBe(true);
  });
});
