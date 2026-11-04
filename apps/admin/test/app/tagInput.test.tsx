import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { TagInput } from "../../src/app/components/TagInput";

function Harness({ initial = ["Oil"] }: { initial?: string[] }) {
  const [tags, setTags] = useState(initial);
  return <TagInput tags={tags} suggestions={["Oil", "Paper"]} onChange={setTags} />;
}

describe("TagInput", () => {
  it("focuses the text field when the empty part of the box is clicked", () => {
    const { container } = render(<Harness />);
    const box = container.firstElementChild!.firstElementChild as HTMLElement;
    fireEvent.click(box);
    expect(document.activeElement).toBe(screen.getByRole("combobox"));
  });

  it("does not steal clicks meant for a tag's remove button", () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "Remove tag Oil" }));
    expect(screen.queryByText("Oil")).toBeNull();
  });

  it("adds a typed tag with Enter and offers existing ones", () => {
    render(<Harness initial={[]} />);
    const input = screen.getByRole("combobox");
    fireEvent.change(input, { target: { value: "pa" } });
    expect(screen.getByRole("option", { name: "Paper" })).toBeTruthy();
    fireEvent.change(input, { target: { value: "Ink" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(screen.getByText("Ink")).toBeTruthy();
  });
});
