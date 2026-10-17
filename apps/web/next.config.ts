import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  transpilePackages: ["@openlabel/lorvexa"],
  partialPrefetching: true,
};

export default nextConfig;
