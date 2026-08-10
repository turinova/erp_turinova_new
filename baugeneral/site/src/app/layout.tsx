import type { Metadata, Viewport } from "next"
import { IBM_Plex_Sans } from "next/font/google"
import Script from "next/script"
import { Analytics } from "@vercel/analytics/next"
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

const ibmPlex = IBM_Plex_Sans({
  variable: "--font-ibm-plex",
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600", "700"],
})

export const metadata: Metadata = {
  metadataBase: new URL(COMPANY.website),
  title: {
    template: `%s | ${COMPANY.brand}`,
    default: COMPANY.brand,
  },
  description: COMPANY.entityDefinitionHu,
  applicationName: COMPANY.brand,
  manifest: "/site.webmanifest",
  robots: getDefaultRobots(),
  // Same token as previous Squarespace GSC property (https://www.baugeneral.hu).
  // Override with GOOGLE_SITE_VERIFICATION if Google issues a new code.
  verification: {
    google:
      process.env.GOOGLE_SITE_VERIFICATION ??
      "uE5yQWs0cZTUxSF0yxxT_A3VrjJh1GsCwkeL-T3lWuo",
  },
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
  twitter: {
    card: "summary_large_image",
    title: COMPANY.brand,
    description: COMPANY.entityDefinitionHu,
    images: [DEFAULT_OG_IMAGE],
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
    <html lang="hu" className={`${ibmPlex.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col font-sans">
        <a href="#main-content" className="skip-to-content">
          Ugrás a tartalomhoz
        </a>
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
          <main id="main-content" className="flex-1">
            {children}
          </main>
          <SiteFooter />
        </SmoothScroll>
        <Analytics />
      </body>
    </html>
  )
}
