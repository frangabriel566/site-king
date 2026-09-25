import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Safety net only — real image uploads bypass Server Actions
      // entirely now (browser uploads straight to Supabase Storage,
      // see lib/client-upload.ts). This just gives headroom to the
      // small JSON payloads (images_json/variants_json) admin forms
      // still submit through actions.
      bodySizeLimit: "5mb",
    },
  },
  images: {
    // Explicit allow-list required starting in Next.js 16. 75 is every
    // `next/image` that doesn't pass a `quality` prop (the library's own
    // default); 90 is the banners; 95 is the product gallery, whose photo
    // gets magnified 1.8x by the hover zoom and shows every artifact.
    qualities: [75, 90, 95],
    // How long an optimized copy is served before the optimizer redoes it.
    // Next's default (60s) defers to the origin's max-age, and Supabase
    // Storage sends one hour — so every photo went back to a cold cache
    // hourly, and a cold cache is exactly when the optimizer is slow enough
    // to time out (see components/shop/safe-image.tsx). Every upload gets a
    // fresh UUID file name (lib/client-upload.ts), so a URL's bytes never
    // change and a copy can't go stale: 31 days, also the browser's max-age.
    minimumCacheTTL: 2678400,
    // WebP only, on purpose: the uploads already are WebP, and AVIF costs
    // several times longer to encode on a cold cache — the step that was
    // timing out — for a few KB less on a photo that is then cached anyway.
    formats: ["image/webp"],
    remotePatterns: [
      // Supabase Storage — public "media" bucket.
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
      // Seed placeholder photography — replace with real product
      // photos uploaded through the admin panel.
      {
        protocol: "https",
        hostname: "picsum.photos",
      },
      {
        protocol: "https",
        hostname: "fastly.picsum.photos",
      },
    ],
  },
};

export default nextConfig;
