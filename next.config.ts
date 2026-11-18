import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Emit a fully static site to `out/`. No Node.js server is used in production.
  output: "export",
  // Write `/route/index.html` so routes resolve on any static file host.
  trailingSlash: true,
  // The default image loader needs a server, so serve images as they are.
  images: {
    unoptimized: true,
  },
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
