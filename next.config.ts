import type { NextConfig } from "next";

// GitHub Pages proje sayfası: https://<kullanıcı>.github.io/<repo>/
// Yerelde boş bırakılır; CI'da NEXT_PUBLIC_BASE_PATH=/ustatakip gibi verilir.
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

const nextConfig: NextConfig = {
  output: "export",
  basePath,
  trailingSlash: true,
  images: { unoptimized: true },
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
