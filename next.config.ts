import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Safety net only — image uploads go through /api/upload, not Server
      // Actions. This just gives headroom to the small JSON payloads
      // (images_json/variants_json) admin forms still submit through actions.
      bodySizeLimit: "5mb",
    },
  },
  images: {
    // No optimizer: photos are resized in the browser at upload time
    // (lib/client-upload.ts) and stored in two sizes; this loader picks
    // between them by the width next/image asks for. See lib/image-loader.ts.
    loader: "custom",
    loaderFile: "./lib/image-loader.ts",
  },
};

// Gives `next dev` the same D1/KV bindings `wrangler dev` has (local state
// in .wrangler/), so getCloudflareContext() works outside the Worker too.
if (process.env.NODE_ENV === "development") {
  void initOpenNextCloudflareForDev();
}

export default nextConfig;
