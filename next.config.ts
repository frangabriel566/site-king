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
    // default); 90 is banner-carousel.tsx's hero image, the only place
    // that overrides it.
    qualities: [75, 90],
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
