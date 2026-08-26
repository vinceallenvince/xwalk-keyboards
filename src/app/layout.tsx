import type { Metadata } from "next";
import Script from "next/script";
import { Archivo, Big_Shoulders, Geist_Mono } from "next/font/google";
import "./globals.css";

// Figma type ramp: Archivo Black for the wordmark/hero, Geist Mono for all
// technical metadata, Big Shoulders (the renamed "Big Shoulders Display"
// family — its Display cut is now the high end of the `opsz` axis) for the
// study selector.
const archivo = Archivo({ subsets: ["latin"], variable: "--font-display" });
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-mono" });
const bigShoulders = Big_Shoulders({ axes: ["opsz"], subsets: ["latin"], variable: "--font-selector" });

export const metadata: Metadata = {
  description: "XWALK KEYBOARDS — NYC crosswalk keyboard studies.",
  icons: { icon: "/favicon.svg" },
  title: "XWALK KEYBOARDS",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html className={`${archivo.variable} ${geistMono.variable} ${bigShoulders.variable}`} lang="en">
      <body>
        {children}
        {/* Cloudflare Web Analytics — cookieless, no consent banner required.
            The token is a public site identifier, not a secret. */}
        <Script
          data-cf-beacon='{"token": "e0047d2327a74750828cc34bcb820d35"}'
          src="https://static.cloudflareinsights.com/beacon.min.js"
          strategy="afterInteractive"
        />
      </body>
    </html>
  );
}
