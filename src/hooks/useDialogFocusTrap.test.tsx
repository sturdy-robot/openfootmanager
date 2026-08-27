import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useDialogFocusTrap } from "./useDialogFocusTrap";

function Dialog({ onClose }: { onClose: () => void }) {
  const dialog = useDialogFocusTrap<HTMLDivElement>(onClose);
  return (
    <div aria-label="Panel" onKeyDown={dialog.onKeyDown} role="dialog">
      <button type="button">First</button>
      <button type="button">Middle</button>
      <button type="button">Last</button>
    </div>
  );
}

function Screen({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <>
      <button type="button">Opener</button>
      {open ? <Dialog onClose={onClose} /> : null}
    </>
  );
}

describe("holding focus inside a dialog", () => {
  it("closes on Escape, so a keyboard has the same way out as a pointer", () => {
    const onClose = vi.fn();
    render(<Screen onClose={onClose} open />);

    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });

    expect(onClose).toHaveBeenCalledOnce();
  });

  it("wraps from the last control back to the first", () => {
    render(<Screen onClose={vi.fn()} open />);
    const last = screen.getByRole("button", { name: "Last" });
    last.focus();

    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Tab" });

    expect(screen.getByRole("button", { name: "First" })).toHaveFocus();
  });

  it("wraps backwards from the first control to the last", () => {
    render(<Screen onClose={vi.fn()} open />);
    screen.getByRole("button", { name: "First" }).focus();

    fireEvent.keyDown(screen.getByRole("dialog"), {
      key: "Tab",
      shiftKey: true,
    });

    expect(screen.getByRole("button", { name: "Last" })).toHaveFocus();
  });

  it("leaves a tab in the middle of the dialog alone", () => {
    render(<Screen onClose={vi.fn()} open />);
    const middle = screen.getByRole("button", { name: "Middle" });
    middle.focus();

    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Tab" });

    // The browser moves focus itself; the trap only has to stay out of the way.
    expect(middle).toHaveFocus();
  });

  it("gives focus back to whoever opened it", () => {
    const { rerender } = render(<Screen onClose={vi.fn()} open={false} />);
    const opener = screen.getByRole("button", { name: "Opener" });
    opener.focus();

    rerender(<Screen onClose={vi.fn()} open />);
    screen.getByRole("button", { name: "Last" }).focus();
    rerender(<Screen onClose={vi.fn()} open={false} />);

    expect(opener).toHaveFocus();
  });
});
