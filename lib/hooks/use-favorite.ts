"use client";

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "king-store:favorites";

function readFavorites(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

function writeFavorites(ids: Set<string>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(ids)));
  } catch {
    // Storage unavailable (private mode, blocked) — favorite state just
    // won't persist across reloads; not worth surfacing an error for.
  }
}

/** Client-only "favorite" toggle, persisted per-browser in localStorage.
 *  There's no account-level wishlist table in the schema, so this is a
 *  lightweight per-device convenience, not synced data. */
export function useFavorite(productId: string) {
  const [isFavorite, setIsFavorite] = useState(false);

  useEffect(() => {
    setIsFavorite(readFavorites().has(productId));
  }, [productId]);

  const toggle = useCallback(
    (e?: React.MouseEvent) => {
      e?.preventDefault();
      e?.stopPropagation();
      const favorites = readFavorites();
      if (favorites.has(productId)) favorites.delete(productId);
      else favorites.add(productId);
      writeFavorites(favorites);
      setIsFavorite(favorites.has(productId));
    },
    [productId],
  );

  return { isFavorite, toggle };
}
