import type {
  Metadata,
  Viewport,
} from "next";
import { Geist, Geist_Mono } from "next/font/google";

import NebuSkinController from "@/components/player/NebuSkinController";

import "./globals.css";


const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Ancient Pulls",
  description: "Make wishes, build your binder and explore your constellation.",
   icons: {
    icon: "/ancient-pulls/celestial-cat.png",
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
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <NebuSkinController />
        {children}
      </body>
    </html>
  );
}
