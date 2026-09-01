import type { MetadataRoute } from "next";

import { getConfiguredPublicOrigin } from "@/lib/auth/navigation";

const PRIVATE_PATHS = [
  "/admin/",
  "/api/",
  "/auth/",
  "/achievements",
  "/catalogue",
  "/check-email",
  "/collection",
  "/constellation",
  "/friends",
  "/forgot-password",
  "/history",
  "/hq",
  "/leaderboard",
  "/orders",
  "/profile",
  "/pulls",
  "/rewards",
  "/shipping",
  "/sign-up",
  "/trade",
  "/update-password",
  "/wallet",
  "/welcome",
  "/wishes",
];

export default function robots(): MetadataRoute.Robots {
  const origin =
    getConfiguredPublicOrigin() || "https://www.ancientpulls.com";

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: PRIVATE_PATHS,
    },
    sitemap: `${origin}/sitemap.xml`,
    host: origin,
  };
}
