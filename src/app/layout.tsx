import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin", "latin-ext"],
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "UstaTakip", template: "%s · UstaTakip" },
  description: "Esnaf için kargo takibi mantığında iş takibi",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#4F46E5",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="tr" className={jakarta.variable}>
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
