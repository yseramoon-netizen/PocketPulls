import type { MetadataRoute } from "next";

import { getConfiguredPublicOrigin } from "@/lib/auth/navigation";

const PUBLIC_ROUTES = [
  "/sign-in",
  "/create-account",
  "/help",
  "/faq",
  "/how-wishes-work",
  "/odds",
  "/rules",
  "/player-protection",
  "/terms",
  "/returns",
  "/shipping-policy",
  "/privacy",
  "/cookies",
  "/contact",
];

export default function sitemap(): MetadataRoute.Sitemap {
  const origin =
    getConfiguredPublicOrigin() || "https://www.ancientpulls.com";
  const lastModified = new Date("2026-09-01T00:00:00.000Z");

  return PUBLIC_ROUTES.map((path) => ({
    url: `${origin}${path}`,
    lastModified,
    changeFrequency: path === "/sign-in" ? "monthly" : "yearly",
    priority: path === "/sign-in" ? 0.8 : 0.5,
  }));
}
