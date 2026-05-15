import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import Script from "next/script"
import { CookieConsentShell } from "@/components/site/CookieConsentShell"
import { SiteFooter } from "@/components/site/SiteFooter"
import { SiteHeader } from "@/components/site/SiteHeader"
import { buildOrganizationJsonLd, COMPANY } from "@/lib/company"
import { DEFAULT_OG_IMAGE, getDefaultRobots } from "@/lib/seo"
import "./globals.css"

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(COMPANY.website),
  title: {
    template: "%s | Hírös-Ablak",
    default: "Hírös-Ablak",
  },
  description:
    "Lapszabászat és élzárás Kecskeméten, barkácsáruház bemutatás, ipari megoldások és anyagkatalógus (bútorlap, munkalap).",
  robots: getDefaultRobots(),
  openGraph: {
    type: "website",
    siteName: COMPANY.brand,
    locale: "hu_HU",
    url: "/",
    images: [{ url: DEFAULT_OG_IMAGE, width: 1200, height: 630, alt: COMPANY.brand }],
  },
  twitter: {
    card: "summary_large_image",
    images: [DEFAULT_OG_IMAGE],
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="hu"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <Script
          id="jsonld-organization"
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(buildOrganizationJsonLd()),
          }}
        />
        <CookieConsentShell>
          <SiteHeader />
          <main className="flex-1">{children}</main>
          <SiteFooter />
        </CookieConsentShell>
      </body>
    </html>
  );
}
