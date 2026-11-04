import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useDragReorder } from "../../src/app/lib/useDragReorder";

const items = [{ id: 1 }, { id: 2 }, { id: 3 }];

function Harness({ onCommit }: { onCommit: (ids: number[]) => void }) {
  const drag = useDragReorder(items, onCommit);
  return (
    <ul>
      {drag.shown.map((i) => {
        const h = drag.handlers(i.id);
        return (
          <li key={i.id} data-reorder-id={i.id} data-testid={`item-${i.id}`}>
            <button aria-label={`handle ${i.id}`} onPointerDown={h.onPointerDown} onKeyDown={h.onKeyDown} />
          </li>
        );
      })}
    </ul>
  );
}

const move = (x = 1, y = 1) => act(() => void window.dispatchEvent(Object.assign(new Event("pointermove"), { clientX: x, clientY: y })));
const release = () => act(() => void window.dispatchEvent(new Event("pointerup")));
const order = () => screen.getAllByRole("listitem").map((li) => li.getAttribute("data-reorder-id"));

afterEach(() => {
  // @ts-expect-error jsdom has no elementFromPoint; the tests install a stub
  delete document.elementFromPoint;
});

describe("useDragReorder", () => {
  it("follows the pointer on window, so it still works after the dragged element moves and the browser drops pointer capture", () => {
    const onCommit = vi.fn();
    render(<Harness onCommit={onCommit} />);
    document.elementFromPoint = () => screen.getByTestId("item-3");
    fireEvent.pointerDown(screen.getByLabelText("handle 1"), { pointerId: 1 });
    move();
    expect(order()).toEqual(["2", "3", "1"]);
    release();
    expect(onCommit).toHaveBeenCalledExactlyOnceWith([2, 3, 1]);
  });

  it("does not commit when the item is dropped where it started", () => {
    const onCommit = vi.fn();
    render(<Harness onCommit={onCommit} />);
    document.elementFromPoint = () => screen.getByTestId("item-1");
    fireEvent.pointerDown(screen.getByLabelText("handle 1"), { pointerId: 1 });
    move();
    release();
    expect(onCommit).not.toHaveBeenCalled();
  });

  it("returns to the real order after the drop and ignores later pointer movement", () => {
    render(<Harness onCommit={() => {}} />);
    document.elementFromPoint = () => screen.getByTestId("item-2");
    fireEvent.pointerDown(screen.getByLabelText("handle 1"), { pointerId: 1 });
    move();
    release();
    expect(order()).toEqual(["1", "2", "3"]);
    document.elementFromPoint = () => screen.getByTestId("item-3");
    move();
    expect(order()).toEqual(["1", "2", "3"]);
  });

  it("moves an item one step with the arrow keys", () => {
    const onCommit = vi.fn();
    render(<Harness onCommit={onCommit} />);
    fireEvent.keyDown(screen.getByLabelText("handle 2"), { key: "ArrowRight" });
    expect(onCommit).toHaveBeenCalledWith([1, 3, 2]);
    onCommit.mockClear();
    fireEvent.keyDown(screen.getByLabelText("handle 1"), { key: "ArrowLeft" });
    expect(onCommit).not.toHaveBeenCalled();
  });
});
