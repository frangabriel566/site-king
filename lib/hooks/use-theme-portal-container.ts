"use client";

import { useState } from "react";

/**
 * Radix portals (Sheet/Dialog/Select, etc.) append to `document.body` by
 * default, which sits outside the `.storefront-theme` scoped wrapper div
 * that carries the public site's light-theme CSS variables. Without a
 * container override, portaled content silently falls back to the admin
 * panel's dark `:root` tokens (e.g. white text on a white sheet). Returns
 * the storefront theme root when present, so callers can pass it as the
 * portal's `container` — a no-op inside the admin, which never has that
 * class in its DOM.
 */
export function useThemePortalContainer() {
  const [container] = useState<HTMLElement | undefined>(() =>
    typeof document === "undefined"
      ? undefined
      : (document.querySelector(".storefront-theme") as HTMLElement | null) ?? undefined,
  );
  return container;
}
