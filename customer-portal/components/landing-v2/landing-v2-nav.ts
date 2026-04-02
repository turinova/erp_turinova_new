/** Közös navigáció: Navbar + Footer (ne essen szét a két hely). */

export const LANDING_V2_NAV = [
  { label: 'Főoldal', href: '/v2' },
  { label: 'Funkciók', href: '/v2/funkciok' },
  { label: 'Árazás', href: '/v2#arazas' },
  { label: 'GYIK', href: '/v2#gyik' },
  { label: 'Kapcsolat', href: '/v2#demo' },
] as const

/** Navbar-ban a Funkciók után (mega melletti horgony linkek). */
export const LANDING_V2_NAV_ANCHORS_AFTER_FUNKCIOK = LANDING_V2_NAV.slice(2)

export const LANDING_V2_DEMO = { label: 'Demo foglalása', href: '/v2#demo' } as const
