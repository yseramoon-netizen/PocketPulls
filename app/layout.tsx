import type {
  Metadata,
  Viewport,
} from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";

import NebuSkinController from "@/components/player/NebuSkinController";
import CookieNotice from "@/components/legal/CookieNotice";
import LegalFooter from "@/components/legal/LegalFooter";
import { getConfiguredPublicOrigin } from "@/lib/auth/navigation";

import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(
    getConfiguredPublicOrigin() || "https://www.ancientpulls.com",
  ),
  title: {
    default: "Ancient Pulls",
    template: "%s | Ancient Pulls",
  },
  description: "Make wishes, build your binder and explore your constellation.",
  applicationName: "Ancient Pulls",
  category: "games",
  openGraph: {
    type: "website",
    siteName: "Ancient Pulls",
    title: "Ancient Pulls",
    description:
      "Make wishes, build your binder and explore your constellation.",
    images: [
      {
        url: "/ancient-pulls/celestial-cat.png",
        width: 1254,
        height: 1254,
        alt: "Ancient Pulls celestial cat",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Ancient Pulls",
    description:
      "Make wishes, build your binder and explore your constellation.",
    images: ["/ancient-pulls/celestial-cat.png"],
  },
  robots: {
    index: true,
    follow: true,
  },
  icons: {
    icon: {
      url: "/ancient-pulls/golden-star-tab.svg",
      type: "image/svg+xml",
    },
    shortcut: "/ancient-pulls/golden-star-tab.svg",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#02030d",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      data-nebu-skin="midnight"
      className={`${GeistSans.variable} ${GeistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <NebuSkinController />
        {children}
        <LegalFooter />
        <CookieNotice />
      </body>
    </html>
  );
}
