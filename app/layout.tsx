import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Sweetpotato Skin Prediction & Validation Platform",
  description: "Collaborative research platform for preharvest sweetpotato skinning prediction, harvest optimization, and validation."
};

export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
