/**
 * DNS-szolgáltatók (ahol a domain DNS-zónája van) — felismerés a névszerverekből,
 * lépésenkénti útmutató a varázslóhoz. Kliensen is használható (nincs Node API).
 */

export type DnsProviderId =
  | 'rackhost'
  | 'tarhely-eu'
  | 'dotroll'
  | 'mediacenter'
  | 'forpsi'
  | 'websupport'
  | 'nethely'
  | 'cloudflare'
  | 'godaddy'
  | 'namecheap'
  | 'hostinger'
  | 'ionos'
  | 'google'
  | 'route53'
  | 'vercel'
  | 'other'

export type DnsProvider = {
  id: DnsProviderId
  name: string
  /** Névszerver-hostnév részletek (kisbetűs). */
  ns: string[]
  loginUrl: string | null
  /** Hol találja a DNS-t (menü útvonal, ahogy a felhasználó látja). */
  where: string
  /** A fő domain (apex) jelölése a Név mezőben. */
  apexHint: string
  extra?: string
}

const GENERIC_WHERE = 'Lépj be → Domainjeim → válaszd ki a domaint → DNS beállítások (DNS zóna) → Új rekord'

export const DNS_PROVIDERS: DnsProvider[] = [
  {
    id: 'rackhost',
    name: 'Rackhost',
    ns: ['rackhost'],
    loginUrl: 'https://www.rackhost.hu',
    where: GENERIC_WHERE,
    apexHint: 'Fő domainnél a Név mezőt hagyd üresen, vagy írj @ jelet — amit a felület elfogad.'
  },
  {
    id: 'tarhely-eu',
    name: 'Tárhely.Eu',
    ns: ['tarhely.eu'],
    loginUrl: 'https://tarhely.eu',
    where: GENERIC_WHERE,
    apexHint: 'Fő domainnél a Név mezőt hagyd üresen, vagy írj @ jelet — amit a felület elfogad.'
  },
  {
    id: 'dotroll',
    name: 'DotRoll',
    ns: ['dotroll'],
    loginUrl: 'https://dotroll.com',
    where: GENERIC_WHERE,
    apexHint: 'Fő domainnél a Név mezőt hagyd üresen, vagy írj @ jelet — amit a felület elfogad.'
  },
  {
    id: 'mediacenter',
    name: 'MediaCenter',
    ns: ['mediacenter'],
    loginUrl: 'https://www.mediacenter.hu',
    where: GENERIC_WHERE,
    apexHint: 'Fő domainnél a Név mezőt hagyd üresen, vagy írj @ jelet — amit a felület elfogad.'
  },
  {
    id: 'forpsi',
    name: 'Forpsi',
    ns: ['forpsi'],
    loginUrl: 'https://www.forpsi.hu',
    where: GENERIC_WHERE,
    apexHint: 'Fő domainnél a Név mezőt hagyd üresen, vagy írj @ jelet — amit a felület elfogad.'
  },
  {
    id: 'websupport',
    name: 'Websupport',
    ns: ['websupport'],
    loginUrl: 'https://www.websupport.hu',
    where: GENERIC_WHERE,
    apexHint: 'Fő domainnél a Név mezőt hagyd üresen, vagy írj @ jelet — amit a felület elfogad.'
  },
  {
    id: 'nethely',
    name: 'Nethely',
    ns: ['nethely'],
    loginUrl: 'https://www.nethely.hu',
    where: GENERIC_WHERE,
    apexHint: 'Fő domainnél a Név mezőt hagyd üresen, vagy írj @ jelet — amit a felület elfogad.'
  },
  {
    id: 'cloudflare',
    name: 'Cloudflare',
    ns: ['ns.cloudflare.com'],
    loginUrl: 'https://dash.cloudflare.com',
    where: 'Lépj be → válaszd ki a domaint → DNS → Records → Add record',
    apexHint: 'Fő domainnél a Name mezőbe @ kerüljön.',
    extra: 'Fontos: a „Proxy status” kapcsoló legyen szürke („DNS only”), ne narancssárga.'
  },
  {
    id: 'godaddy',
    name: 'GoDaddy',
    ns: ['domaincontrol.com'],
    loginUrl: 'https://dcc.godaddy.com',
    where: 'Lépj be → My Products → a domain mellett DNS → Add New Record',
    apexHint: 'Fő domainnél a Name mezőbe @ kerüljön.'
  },
  {
    id: 'namecheap',
    name: 'Namecheap',
    ns: ['registrar-servers.com'],
    loginUrl: 'https://ap.www.namecheap.com',
    where: 'Lépj be → Domain List → Manage → Advanced DNS → Add new record',
    apexHint: 'Fő domainnél a Host mezőbe @ kerüljön.'
  },
  {
    id: 'hostinger',
    name: 'Hostinger',
    ns: ['dns-parking.com', 'hostinger'],
    loginUrl: 'https://hpanel.hostinger.com',
    where: 'Lépj be → Domains → a domain → DNS / Nameservers → DNS records',
    apexHint: 'Fő domainnél a Name mezőbe @ kerüljön.'
  },
  {
    id: 'ionos',
    name: 'IONOS',
    ns: ['ui-dns.'],
    loginUrl: 'https://my.ionos.com',
    where: 'Lépj be → Domains & SSL → a domain → DNS → Add record',
    apexHint: 'Fő domainnél a Host name mezőbe @ kerüljön.'
  },
  {
    id: 'google',
    name: 'Squarespace (Google Domains)',
    ns: ['googledomains.com', 'squarespacedns.com'],
    loginUrl: 'https://account.squarespace.com/domains',
    where: 'Lépj be → Domains → a domain → DNS → Custom records',
    apexHint: 'Fő domainnél a Host mezőbe @ kerüljön.'
  },
  {
    id: 'route53',
    name: 'Amazon Route 53',
    ns: ['awsdns'],
    loginUrl: 'https://console.aws.amazon.com/route53',
    where: 'Hosted zones → a domain → Create record',
    apexHint: 'Fő domainnél a Record name mezőt hagyd üresen.'
  },
  {
    id: 'vercel',
    name: 'Vercel',
    ns: ['vercel-dns.com'],
    loginUrl: null,
    where: 'A domained már a Vercel névszerverein van — nincs teendőd, automatikusan beállítjuk.',
    apexHint: ''
  },
  {
    id: 'other',
    name: 'Más szolgáltató',
    ns: [],
    loginUrl: null,
    where: 'Lépj be oda, ahol a domaint vetted (vagy ahol a tárhelyed van), és keresd: DNS beállítások / DNS zóna / DNS rekordok → Új rekord',
    apexHint: 'Fő domainnél a Név mezőbe @ kerüljön, vagy hagyd üresen — amit a felület elfogad.'
  }
]

export function providerById(id: string | null | undefined): DnsProvider {
  return DNS_PROVIDERS.find((p) => p.id === id) ?? DNS_PROVIDERS[DNS_PROVIDERS.length - 1]!
}

export function detectProvider(nameservers: string[]): DnsProviderId | null {
  const ns = nameservers.map((n) => n.toLowerCase().replace(/\.$/, ''))
  if (ns.length === 0) return null
  for (const p of DNS_PROVIDERS) {
    if (p.ns.length > 0 && ns.some((n) => p.ns.some((frag) => n.includes(frag)))) return p.id
  }
  return 'other'
}
