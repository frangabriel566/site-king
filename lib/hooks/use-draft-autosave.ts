"use client";

import { useEffect, useRef } from "react";

export type StoredDraft<T> = { value: T; savedAt: number };

/** Debounced localStorage snapshot of `value`, restored via readDraft(). */
export function useDraftAutosave<T>(
  key: string,
  value: T,
  { enabled, delayMs = 800 }: { enabled: boolean; delayMs?: number },
) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!enabled) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      try {
        const payload: StoredDraft<T> = { value, savedAt: Date.now() };
        window.localStorage.setItem(key, JSON.stringify(payload));
      } catch {
        // localStorage unavailable (private browsing, quota) — skip silently.
      }
    }, delayMs);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, JSON.stringify(value), enabled, delayMs]);
}

export function readDraft<T>(key: string): StoredDraft<T> | null {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as StoredDraft<T>;
  } catch {
    return null;
  }
}

export function clearDraft(key: string) {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // ignore
  }
}
