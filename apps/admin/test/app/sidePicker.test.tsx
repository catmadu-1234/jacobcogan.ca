import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SidePicker } from "../../src/app/screens/SidePicker";
import { json, stubFetch } from "./stub";

afterEach(() => vi.unstubAllGlobals());

describe("SidePicker", () => {
  it("offers each site as a link that remembers the choice", async () => {
    stubFetch((c) => (c.path === "/api/sides" ? json(200, [{ slug: "site-a", name: "Jacob Cogan" }, { slug: "site-b", name: "Senka" }]) : undefined));
    render(<SidePicker />);
    const a = await screen.findByRole("link", { name: "Jacob Cogan" });
    expect(a.getAttribute("href")).toBe("/api/side/site-a");
    expect(screen.getByRole("link", { name: "Senka" }).getAttribute("href")).toBe("/api/side/site-b");
  });
});
