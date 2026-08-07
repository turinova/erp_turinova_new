import type { Metadata, Viewport } from "next"
import { Geist, Geist_Mono, IBM_Plex_Sans } from "next/font/google"
import Script from "next/script"
import { SiteFooter } from "@/components/site/SiteFooter"
import { SiteHeader } from "@/components/site/SiteHeader"
import { SmoothScroll } from "@/components/site/SmoothScroll"
import {
  buildLocalBusinessJsonLd,
  buildOrganizationJsonLd,
  COMPANY,
} from "@/lib/company"
import { buildWebSiteJsonLd, DEFAULT_OG_IMAGE, getDefaultRobots } from "@/lib/seo"
import "./globals.css"

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin", "latin-ext"],
})

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
})

const ibmPlex = IBM_Plex_Sans({
  variable: "--font-ibm-plex",
  subsets: ["latin", "latin-ext"],
  weight: ["500", "600"],
})

export const metadata: Metadata = {
  metadataBase: new URL(COMPANY.website),
  title: {
    template: `%s | ${COMPANY.brand}`,
    default: COMPANY.brand,
  },
  description: COMPANY.entityDefinitionHu,
  applicationName: COMPANY.brand,
  robots: getDefaultRobots(),
  openGraph: {
    type: "website",
    siteName: COMPANY.brand,
    locale: "hu_HU",
    url: "/",
    images: [
      {
        url: DEFAULT_OG_IMAGE,
        width: 1200,
        height: 630,
        alt: COMPANY.brand,
      },
    ],
  },
}

export const viewport: Viewport = {
  themeColor: "#A60C19",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="hu"
      className={`${geistSans.variable} ${geistMono.variable} ${ibmPlex.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <Script
          id="jsonld-organization"
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(buildOrganizationJsonLd()),
          }}
        />
        <Script
          id="jsonld-website"
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(buildWebSiteJsonLd()),
          }}
        />
        <Script
          id="jsonld-localbusiness"
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(buildLocalBusinessJsonLd()),
          }}
        />
        <SmoothScroll>
          <SiteHeader />
          <main className="flex-1">{children}</main>
          <SiteFooter />
        </SmoothScroll>
      </body>
    </html>
  )
}
