import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // Allow local dev access via 127.0.0.1 (Next 16 blocks cross-origin
  // dev resources like HMR otherwise, which breaks hydration in dev).
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  turbopack: {
    // The repo root contains a legacy package-lock.json (pre-web monorepo).
    // Pin Turbopack's root to the web/ app so dev-server asset resolution
    // and HMR work correctly.
    root: __dirname,
  },
};

export default nextConfig;
