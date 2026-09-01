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
  async redirects() {
    return [
      { source: "/support", destination: "/help#support", permanent: true },
      { source: "/orders", destination: "/shipping#orders", permanent: true },
      { source: "/trade", destination: "/friends?panel=trade", permanent: true },
      {
        source: "/history",
        destination: "/constellation?panel=history",
        permanent: true,
      },
    ];
  },
  async headers() {
    const publicAssetCache = [
      {
        key: "Cache-Control",
        value: "public, max-age=604800, stale-while-revalidate=2592000",
      },
    ];

    const privateRouteHeaders = [
      { key: "Cache-Control", value: "private, no-store, max-age=0" },
      { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" },
    ];
    const privateRoutePatterns = [
      "/admin/:path*",
      "/auth/:path*",
      "/achievements/:path*",
      "/catalogue/:path*",
      "/check-email/:path*",
      "/collection/:path*",
      "/constellation/:path*",
      "/forgot-password/:path*",
      "/friends/:path*",
      "/history/:path*",
      "/hq/:path*",
      "/leaderboard/:path*",
      "/orders/:path*",
      "/profile/:path*",
      "/pulls/:path*",
      "/rewards/:path*",
      "/shipping/:path*",
      "/sign-up/:path*",
      "/trade/:path*",
      "/update-password/:path*",
      "/wallet/:path*",
      "/welcome/:path*",
      "/wishes/:path*",
    ];

    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value:
              "camera=(self), microphone=(), geolocation=(), browsing-topics=()",
          },
          {
            key: "Cross-Origin-Opener-Policy",
            value: "same-origin-allow-popups",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains",
          },
          { key: "X-Permitted-Cross-Domain-Policies", value: "none" },
        ],
      },
      {
        source: "/api/:path*",
        headers: [
          { key: "Cache-Control", value: "private, no-store, max-age=0" },
          { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" },
        ],
      },
      ...privateRoutePatterns.map((source) => ({
        source,
        headers: privateRouteHeaders,
      })),
      { source: "/ancient-pulls/:path*", headers: publicAssetCache },
      { source: "/tree-wonder/:path*", headers: publicAssetCache },
      { source: "/shaymin-moods/:path*", headers: publicAssetCache },
      { source: "/binders/:path*", headers: publicAssetCache },
    ];
  },
};

export default nextConfig;
