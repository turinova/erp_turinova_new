import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import Script from "next/script"
import { CookieConsentShell } from "@/components/site/CookieConsentShell"
import { SiteFooter } from "@/components/site/SiteFooter"
import { SiteHeader } from "@/components/site/SiteHeader"
import { buildOrganizationJsonLd, COMPANY } from "@/lib/company"
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
  openGraph: {
    type: "website",
    siteName: COMPANY.brand,
    url: "/",
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
