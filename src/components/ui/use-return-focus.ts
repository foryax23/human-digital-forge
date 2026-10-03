import * as React from "react";

type AutoFocusHandler = (event: Event) => void;

/**
 * Radix gives focus back only to a DialogTrigger, so a dialog opened from state (a
 * button that sets `open`) would drop keyboard focus on <body> when it closes. This
 * remembers what had focus when the dialog opened (the open event fires before focus
 * moves in) and returns there, unless the caller prevented it or that element is gone.
 * Used by the dialog (ui/dialog.tsx) and the bottom sheet (ui/drawer.tsx).
 */
export function useReturnFocus(onOpen?: AutoFocusHandler, onClose?: AutoFocusHandler) {
  const opener = React.useRef<HTMLElement | null>(null);
  return {
    onOpenAutoFocus: (event: Event) => {
      const active = typeof document === "undefined" ? null : document.activeElement;
      opener.current = active instanceof HTMLElement && active !== document.body ? active : null;
      onOpen?.(event);
    },
    onCloseAutoFocus: (event: Event) => {
      onClose?.(event);
      if (event.defaultPrevented) return;
      const el = opener.current;
      opener.current = null;
      if (el?.isConnected) {
        event.preventDefault();
        el.focus({ preventScroll: true });
      }
    },
  };
}
