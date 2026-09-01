"use client";

import { useEffect } from "react";

const CONFIRM_MESSAGE = "Você tem alterações não salvas. Sair mesmo assim?";

/**
 * Warns before the tab closes/reloads (native beforeunload) and before
 * an in-app link navigation (sidebar, footer, breadcrumbs) while
 * `isDirty` is true. There's no first-class "block this route change"
 * API in the App Router, so in-app navigation is caught with a
 * capture-phase click listener on same-document anchor clicks instead.
 */
export function useUnsavedChangesGuard(isDirty: boolean) {
  useEffect(() => {
    function handleBeforeUnload(event: BeforeUnloadEvent) {
      if (!isDirty) return;
      event.preventDefault();
      event.returnValue = "";
    }

    function handleClick(event: MouseEvent) {
      if (!isDirty) return;
      const target = (event.target as HTMLElement | null)?.closest("a[href]");
      if (!target) return;
      const href = target.getAttribute("href");
      if (!href || href.startsWith("#")) return;
      if (!window.confirm(CONFIRM_MESSAGE)) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    }

    window.addEventListener("beforeunload", handleBeforeUnload);
    document.addEventListener("click", handleClick, true);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      document.removeEventListener("click", handleClick, true);
    };
  }, [isDirty]);
}

export function confirmDiscardUnsavedChanges(isDirty: boolean): boolean {
  if (!isDirty) return true;
  return window.confirm(CONFIRM_MESSAGE);
}
