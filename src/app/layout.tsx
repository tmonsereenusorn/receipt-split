import type { Metadata, Viewport } from "next";
import { VT323, Caveat } from "next/font/google";
import "./globals.css";

const vt323 = VT323({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-receipt",
});

const caveat = Caveat({
  subsets: ["latin"],
  variable: "--font-handwritten",
});

export const metadata: Metadata = {
  title: "Shplit",
  description: "Shplit — split receipts with friends. Scan, assign, and calculate per-person totals",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${vt323.variable} ${caveat.variable} antialiased bg-[var(--page-bg)] text-[var(--ink)]`}
      >
        <main className="mx-auto min-h-screen max-w-md px-4 py-6">
          {children}
        </main>
      </body>
    </html>
  );
}
