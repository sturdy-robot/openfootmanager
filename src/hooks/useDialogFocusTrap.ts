import { useEffect, useRef, type KeyboardEvent } from "react";

/**
 * Everything that can hold focus inside a dialog, in document order.
 *
 * `[tabindex="-1"]` is deliberately absent: an element taken out of the tab
 * order should not be cycled back into it by the trap.
 */
const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export interface DialogFocusTrap<E extends HTMLElement> {
  /** Put on the dialog element, alongside `role="dialog"`. */
  onKeyDown: (event: KeyboardEvent<E>) => void;
}

/**
 * Hold focus inside a modal and give it back when the modal closes.
 *
 * A dialog that leaves the page behind it in the tab order is a dialog a
 * keyboard user tabs straight out of, into controls they cannot see — and one
 * that can be dismissed by clicking outside but not by pressing a key asks
 * more of a pointer than of a keyboard.
 */
export function useDialogFocusTrap<E extends HTMLElement>(
  onClose: () => void,
): DialogFocusTrap<E> {
  // Whoever opened the dialog. Focus goes back to them, so a manager who
  // closes the panel is where they were rather than at the top of the page.
  const openerRef = useRef<Element | null>(null);

  useEffect(() => {
    openerRef.current = document.activeElement;
    return () => {
      const opener = openerRef.current;
      if (opener instanceof HTMLElement && opener.isConnected) {
        opener.focus();
      }
    };
  }, []);

  const onKeyDown = (event: KeyboardEvent<E>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
      return;
    }
    if (event.key !== "Tab") return;

    const focusable = Array.from(
      event.currentTarget.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
    );
    if (focusable.length === 0) {
      // Nothing to move to, so moving anywhere would leave the dialog.
      event.preventDefault();
      return;
    }

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  return { onKeyDown };
}
