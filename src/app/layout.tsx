import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  description: "XWALK KEYBOARDS — NYC crosswalk keyboard studies.",
  title: "XWALK KEYBOARDS",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
