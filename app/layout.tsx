import type { Metadata, Viewport } from "next";
import {Suspense} from "react";
import "./globals.css";
import NavProgress from "./NavProgress";
import {SITE_URL} from "@/lib/site";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "RepCount — Stronger, in your own space.",
  description: "Personal home training, weekly trainer support and everyday progress with RepCount’s India pilot.",
  robots: { index: false, follow: false },
  applicationName: "RepCount",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/repcount-mark.svg", apple: "/apple-touch-icon.png" },
  appleWebApp: { title: "RepCount" },
  openGraph: {
    title: "RepCount — Stronger, in your own space.",
    description: "Personal training. Thoughtful support. A plan for the life you actually live.",
    type: "website",
    images: [{ url: "/repcount-share.png", width: 1200, height: 630, alt: "RepCount. Stronger, in your own space." }],
  },
  twitter: { card: "summary_large_image" },
};

export const viewport: Viewport = { themeColor: "#faf7f1", viewportFit: "cover" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body><Suspense fallback={null}><NavProgress/></Suspense>{children}</body></html>;
}
