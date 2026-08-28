import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  compress: true,
  images: {
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 86_400,
  },
  outputFileTracingIncludes: {
    "/api/admin/shaymin-art/*": ["private-assets/shaymin/*.png"],
  },
  async headers() {
    const publicAssetCache = [
      {
        key: "Cache-Control",
        value: "public, max-age=604800, stale-while-revalidate=2592000",
      },
    ];

    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=(), usb=(), payment=(self)" },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
          { key: "X-DNS-Prefetch-Control", value: "off" },
        ],
      },
      { source: "/ancient-pulls/:path*", headers: publicAssetCache },
      { source: "/tree-wonder/:path*", headers: publicAssetCache },
      { source: "/shaymin-moods/:path*", headers: publicAssetCache },
      { source: "/binders/:path*", headers: publicAssetCache },
    ];
  },
};

export default nextConfig;
