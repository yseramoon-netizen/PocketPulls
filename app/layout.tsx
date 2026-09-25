import type {
  Metadata,
  Viewport,
} from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";

import CookieNotice from "@/components/legal/CookieNotice";
import LegalFooter from "@/components/legal/LegalFooter";
import { getConfiguredPublicOrigin } from "@/lib/auth/navigation";

import "./globals.css";
import "./astral.css";
import "./premium.css";
import "./sanctuary.css";

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
        url: "/ancient-pulls/astral-share.png",
        width: 1200,
        height: 630,
        alt: "Ancient Pulls — a universe of your own",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Ancient Pulls",
    description:
      "Make wishes, build your binder and explore your constellation.",
    images: ["/ancient-pulls/astral-share.png"],
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
      data-design="astra-sanctuary-82"
      className={`${GeistSans.variable} ${GeistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        <LegalFooter />
        <CookieNotice />
      </body>
    </html>
  );
}
