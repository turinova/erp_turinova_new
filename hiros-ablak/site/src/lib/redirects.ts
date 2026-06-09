/**
 * Central redirect map for next.config and documentation.
 * Host canonicalization (non-www → www) is handled in middleware.ts.
 * 410 Gone paths are handled in middleware.ts.
 */

export type LegacyRedirect = {
  source: string
  destination: string
  permanent?: boolean
}

/** Paths that no longer exist (former window/door business). */
export const GONE_PATH_PREFIXES = [
  "/belteriajtok",
] as const

export const LEGACY_REDIRECTS: LegacyRedirect[] = [
  { source: "/barkacsaruhaz", destination: "/barkacsaruhaz-kecskemet", permanent: true },
  { source: "/lapszabaszat", destination: "/szolgaltatasok/lapszabaszat-es-elzaras", permanent: true },
  { source: "/lapszabaszat-1", destination: "/szolgaltatasok/lapszabaszat-es-elzaras", permanent: true },
  {
    source: "/lapszabaszat-kecskemet",
    destination: "/szolgaltatasok/lapszabaszat-es-elzaras",
    permanent: true,
  },
  {
    source: "/ipari-megoldasok",
    destination: "/szolgaltatasok/ipari-megoldasok/szallitolada-keszites",
    permanent: true,
  },
  {
    source: "/egyedi-butorgyartas",
    destination: "/szolgaltatasok/lapszabaszat-es-elzaras",
    permanent: true,
  },
  {
    source: "/egyedi-butorgyartas-kecskemet",
    destination: "/szolgaltatasok/lapszabaszat-es-elzaras",
    permanent: true,
  },
  { source: "/karrier", destination: "/kapcsolat", permanent: true },
  {
    source: "/adatkezelesi-tajekoztatot",
    destination: "/adatkezelesi-tajekoztato",
    permanent: true,
  },
  { source: "/anyagok", destination: "/butorlap", permanent: true },
  { source: "/barkacsaruhaz-kecskemet/", destination: "/barkacsaruhaz-kecskemet", permanent: true },
  { source: "/rolunk", destination: "/", permanent: true },
  { source: "/utmutatok/:path*", destination: "/", permanent: true },
  // Former blog → homepage or relevant service pages
  {
    source: "/blog/mosogato-valsztas-utmutato",
    destination: "/",
    permanent: true,
  },
  {
    source: "/blog/milyen-anyagbol-keszuljon-a-butor",
    destination: "/",
    permanent: true,
  },
  {
    source: "/blog/munkalap-valaszto-utmutato",
    destination: "/",
    permanent: true,
  },
  {
    source: "/blog/granit-mosogatotalca-kisokos",
    destination: "/",
    permanent: true,
  },
  {
    source: "/blog/strongmax-fikrendszer-prmium-megolds-btorokhoz",
    destination: "/barkacsaruhaz-kecskemet",
    permanent: true,
  },
  {
    source: "/blog/kesz-butor-vagy-egyedibutor",
    destination: "/szolgaltatasok/lapszabaszat-es-elzaras",
    permanent: true,
  },
  { source: "/blog", destination: "/", permanent: true },
]
