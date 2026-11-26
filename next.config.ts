import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Emit a fully static site to `out/`. No Node.js server is used in production.
  output: "export",
  // Write `/route.html`. CloudFront's clean-urls function maps `/route` to it.
  trailingSlash: false,
  // The default image loader needs a server, so serve images as they are.
  images: {
    unoptimized: true,
  },
  // Respondents' answers stay in their browser, so no source maps or telemetry are published.
  productionBrowserSourceMaps: false,
  poweredByHeader: false,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
