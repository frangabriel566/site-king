"use client";

import { createContext, useContext, type ReactNode } from "react";
import { EMPTY_SHOP_CONFIG, type ShopConfig } from "@/lib/shop-config";

const ShopConfigContext = createContext<ShopConfig>(EMPTY_SHOP_CONFIG);

/** Hands the store's selling rules (lib/shop-config.ts) to every Client
 * Component of the storefront — set once by app/(shop)/layout.tsx. */
export function ShopConfigProvider({
  value,
  children,
}: {
  value: ShopConfig;
  children: ReactNode;
}) {
  return <ShopConfigContext.Provider value={value}>{children}</ShopConfigContext.Provider>;
}

export function useShopConfig(): ShopConfig {
  return useContext(ShopConfigContext);
}
