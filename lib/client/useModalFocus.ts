"use client";

import { useEffect, useEffectEvent, useRef } from "react";

// A stack keeps nested panels from restoring scroll or closing each other.
const panels: HTMLElement[] = [];
let originalOverflow = "";
const focusable = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

export default function useModalFocus<T extends HTMLElement>(open: boolean, onClose: () => void) {
  const ref = useRef<T>(null);
  const close = useEffectEvent(onClose);

  useEffect(() => {
    const panel = ref.current;
    if (!open || !panel) return;
    const returnTo = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (!panels.length) {
      originalOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
    }
    panels.push(panel);
    const targets = () => Array.from(panel.querySelectorAll<HTMLElement>(focusable))
      .filter((element) => element.tabIndex >= 0 && !element.closest('[inert],[hidden],[aria-hidden="true"]') && element.getClientRects().length > 0);
    const focusFirst = () => (panel.querySelector<HTMLElement>("[data-autofocus]") || targets()[0] || panel).focus({ preventScroll: true });
    const frame = requestAnimationFrame(focusFirst);
    const onKey = (event: KeyboardEvent) => {
      if (panels.at(-1) !== panel) return;
      if (event.key === "Escape" && !event.isComposing) {
        event.preventDefault();
        event.stopPropagation();
        close();
      }
      if (event.key !== "Tab") return;
      const items = targets();
      const first = items[0];
      const last = items.at(-1);
      if (!first || !last) {
        event.preventDefault();
        panel.focus();
      } else if (event.shiftKey && (document.activeElement === first || document.activeElement === panel || !panel.contains(document.activeElement))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !panel.contains(document.activeElement))) {
        event.preventDefault();
        first.focus();
      }
    };
    const onFocus = (event: FocusEvent) => {
      if (panels.at(-1) === panel && event.target instanceof Node && !panel.contains(event.target)) focusFirst();
    };
    document.addEventListener("keydown", onKey, true);
    document.addEventListener("focusin", onFocus);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("keydown", onKey, true);
      document.removeEventListener("focusin", onFocus);
      const wasTop = panels.at(-1) === panel;
      const index = panels.indexOf(panel);
      if (index >= 0) panels.splice(index, 1);
      if (!panels.length) document.body.style.overflow = originalOverflow;
      if (wasTop && returnTo?.isConnected && !returnTo.closest('[inert],[hidden]')) returnTo.focus({ preventScroll: true });
    };
  }, [open]);

  return ref;
}
