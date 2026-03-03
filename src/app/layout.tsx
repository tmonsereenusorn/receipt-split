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
  metadataBase: new URL("https://shplit.vercel.app"),
  title: {
    default: "Shplit — Split Receipts with Friends",
    template: "%s | Shplit",
  },
  description:
    "Scan any receipt, split it with friends, and share a live link. No app download needed.",
  keywords: [
    "split receipt",
    "bill splitter",
    "receipt scanner",
    "split the bill",
    "restaurant bill split",
    "group dining",
    "shared expenses",
  ],
  openGraph: {
    type: "website",
    siteName: "Shplit",
    title: "Shplit — Split Receipts with Friends",
    description:
      "Scan any receipt, split it with friends, and share a live link. No app download needed.",
    url: "https://shplit.vercel.app",
  },
  twitter: {
    card: "summary",
    title: "Shplit — Split Receipts with Friends",
    description:
      "Scan any receipt, split it with friends, and share a live link. No app download needed.",
  },
  alternates: {
    canonical: "https://shplit.vercel.app",
  },
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
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebApplication",
              name: "Shplit",
              url: "https://shplit.vercel.app",
              description:
                "Scan any receipt, split it with friends, and share a live link. No app download needed.",
              applicationCategory: "FinanceApplication",
              operatingSystem: "Any",
              offers: {
                "@type": "Offer",
                price: "0",
                priceCurrency: "USD",
              },
            }),
          }}
        />
        <main className="mx-auto min-h-screen max-w-md px-4 py-6">
          {children}
        </main>
      </body>
    </html>
  );
}
