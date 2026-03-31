// Integrations logo cloud — clean, conversion-focused.
// - No chips, no colored cards: just logos/wordmarks.
// - Use real SVG/PNG in /public when available; fall back to text wordmark.

type Integration = {
  name: string
  logoSrc?: string
  logoAlt?: string
  /** For images (SVG/PNG) */
  logoClassName?: string
  planned?: boolean
}

const webshopLive: Integration[] = [
  {
    name: 'Shoprenter',
    logoSrc: '/Logo/shoprenter-horizontal-default-5.png',
    logoAlt: 'Shoprenter integráció - Turinova ERP',
    logoClassName: 'max-h-12 md:max-h-14',
  },
]

const webshopPlanned: Integration[] = [
  {
    name: 'UNAS',
    logoSrc: '/Logo/unas-logo.png',
    logoAlt: 'UNAS integráció (hamarosan) - Turinova ERP',
    logoClassName: 'max-h-12 md:max-h-14',
    planned: true,
  },
  {
    name: 'Shopify',
    logoSrc: '/Logo/Shopify_logo_2018.svg.png',
    logoAlt: 'Shopify integráció (hamarosan) - Turinova ERP',
    logoClassName: 'max-h-12 md:max-h-14',
    planned: true,
  },
]

const invoicingLive: Integration[] = [
  {
    name: 'Számlázz.hu',
    logoSrc: '/Logo/szamlazzhu_logo-horizontal-1_color.png',
    logoAlt: 'Számlázz.hu integráció - Turinova ERP',
    logoClassName: 'max-h-12 md:max-h-14',
  },
]

const invoicingPlanned: Integration[] = [
  {
    name: 'Billingo',
    logoSrc: '/Logo/logo.png',
    logoAlt: 'Billingo integráció (hamarosan) - Turinova ERP',
    // This asset renders small → bump height
    logoClassName: 'max-h-14 md:max-h-16',
    planned: true,
  },
]

const shippingLive: Integration[] = [
  {
    name: 'Express One',
    logoSrc: '/Logo/Express_One_Hungary_idxX3CYt_m_1.svg',
    logoAlt: 'Express One integráció - Turinova ERP',
    logoClassName: 'max-h-12 md:max-h-14',
  },
  {
    name: 'MPL',
    logoSrc: '/Logo/mp150_logo_fb.jpg',
    logoAlt: 'MPL (Magyar Posta) integráció - Turinova ERP',
    logoClassName: 'max-h-12 md:max-h-14',
  },
  {
    name: 'GLS',
    logoSrc: '/Logo/gls-logo.png',
    logoAlt: 'GLS integráció - Turinova ERP',
    logoClassName: 'max-h-12 md:max-h-14',
  },
  {
    name: 'DPD',
    logoSrc: '/Logo/DPD_logo_(2015).svg.png',
    logoAlt: 'DPD integráció - Turinova ERP',
    logoClassName: 'max-h-12 md:max-h-14',
  },
  {
    name: 'FOXPOST',
    logoSrc: '/Logo/hirlevel_header_foxpost_logo.png',
    logoAlt: 'FOXPOST integráció - Turinova ERP',
    // This asset has extra whitespace → bump height a bit
    logoClassName: 'max-h-14 md:max-h-16',
  },
  {
    name: 'Packeta',
    logoSrc: '/Logo/Logo_Packeta_s.r.o..png',
    logoAlt: 'Packeta integráció - Turinova ERP',
    logoClassName: 'max-h-12 md:max-h-14',
  },
  {
    name: 'Sameday',
    logoSrc: '/Logo/Vilagos_hatterre_Logo_Sameday.png.webp',
    logoAlt: 'Sameday integráció - Turinova ERP',
    // Smaller wordmark inside the image → bump height
    logoClassName: 'max-h-14 md:max-h-16',
  },
  {
    name: 'DHL',
    logoSrc: '/Logo/DHL_Logo.svg.png',
    logoAlt: 'DHL integráció - Turinova ERP',
    logoClassName: 'max-h-12 md:max-h-14',
  },
]

const aiTools: Integration[] = [
  {
    name: 'Anthropic',
    logoSrc: '/Logo/Anthropic_logo.svg',
    logoAlt: 'Anthropic integráció (AI) - Turinova ERP',
    logoClassName: 'max-h-12 md:max-h-14',
  },
  {
    name: 'Twilio',
    logoSrc: '/Logo/Twilio-logo-red.svg.png',
    logoAlt: 'Twilio integráció (SMS/kommunikáció) - Turinova ERP',
    logoClassName: 'max-h-12 md:max-h-14',
  },
]

const google: Integration[] = [
  {
    name: 'Google Analytics',
    logoSrc: '/Logo/Logo_Google_Analytics.svg.png',
    logoAlt: 'Google Analytics integráció - Turinova ERP',
    logoClassName: 'max-h-12 md:max-h-14',
  },
  {
    name: 'Google Ads',
    logoSrc: '/Logo/pngfind.com-power-bi-logo-png-3283853.png',
    logoAlt: 'Google Ads integráció - Turinova ERP',
    logoClassName: 'max-h-14 md:max-h-16',
  },
  {
    name: 'Search Console',
    logoSrc: '/Logo/63108a5d62ead989f3ce5081_google_search_console_logo.svg',
    logoAlt: 'Google Search Console integráció - Turinova ERP',
    logoClassName: 'max-h-12 md:max-h-14',
  },
  {
    name: 'Merchant Center',
    logoSrc: '/Logo/65215889d773cd686ada9586_Google-Merchant-Center-wide-final.png',
    logoAlt: 'Google Merchant Center integráció - Turinova ERP',
    logoClassName: 'max-h-14 md:max-h-16',
  },
]

function LogoItem({ name, logoSrc, logoAlt, logoClassName }: Integration) {
  return (
    <div className="flex items-center justify-center h-16 sm:h-18 md:h-20 px-4">
      {logoSrc ? (
        <img
          src={logoSrc}
          alt={logoAlt || `${name} integráció - Turinova ERP`}
          loading="lazy"
          decoding="async"
          className={
            (logoClassName || 'max-h-12 md:max-h-14') +
            ' w-auto max-w-[220px] object-contain'
          }
          style={{ objectFit: 'contain' }}
        />
      ) : (
        <span className="text-sm sm:text-base font-semibold tracking-tight text-slate-500">
          {name}
        </span>
      )}
    </div>
  )
}

function Grid({
  items,
  colsClassName
}: {
  items: Integration[]
  colsClassName: string
}) {
  return (
    <div className={'grid items-center justify-items-center ' + colsClassName}>
      {items.map(item => (
        <div key={item.name} className="relative w-full">
          <div
            className={
              // Default: full color (more vibrant). Hover: grayscale (calm).
              (item.planned
                ? 'opacity-55 grayscale '
                : 'opacity-100 grayscale-0 ') +
              'hover:opacity-70 hover:grayscale transition-all duration-200'
            }
          >
            <LogoItem {...item} />
          </div>

          {item.planned && (
            <div className="absolute top-1 right-1">
              <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-white/85 text-slate-600 border border-slate-200 shadow-sm backdrop-blur">
                Hamarosan
              </span>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

export default function Integrations() {
  return (
    <section
      id="integrations"
      className="bg-white py-12 scroll-mt-20"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">

        <div className="relative overflow-hidden rounded-3xl border border-slate-200/60 bg-gradient-to-br from-white via-orange-50/30 to-sky-50/30 px-6 py-12 sm:px-10">
          {/* Decorative blobs */}
          <div
            aria-hidden
            className="pointer-events-none absolute -top-28 -right-28 h-72 w-72 rounded-full blur-3xl"
            style={{ background: 'radial-gradient(circle, rgba(251,146,60,0.15) 0%, transparent 70%)' }}
          />
          <div
            aria-hidden
            className="pointer-events-none absolute -bottom-28 -left-28 h-72 w-72 rounded-full blur-3xl"
            style={{ background: 'radial-gradient(circle, rgba(125,211,252,0.18) 0%, transparent 70%)' }}
          />
          {/* Subtle dot grid */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-[0.35]"
            style={{
              backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(148,163,184,0.35) 1px, transparent 0)',
              backgroundSize: '28px 28px',
            }}
          />

          <div className="relative">
            {/* Headline */}
            <div className="text-center mb-10">
              <span className="inline-flex items-center gap-2 rounded-full border border-orange-200/60 bg-white/70 px-3 py-1 text-[11px] font-semibold uppercase tracking-widest text-orange-700 shadow-sm">
                Integrációk
              </span>
              <h2 className="mt-4 text-2xl sm:text-3xl font-bold text-slate-900">
                Minden amit használsz, egy helyen
              </h2>
              <p className="mt-2 text-slate-600 text-sm">
                Turinova ERP — webshop, számlázás, szállítás és marketing integrációk.
              </p>
            </div>

            {/* Webshop + Számlázás (2 columns on desktop) */}
            <div className="mb-12 grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-12">
              {/* Webshop */}
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400 mb-4 text-center">
                  Webshop
                </p>
                <div className="mx-auto max-w-4xl">
                  <Grid
                    items={[...webshopLive, ...webshopPlanned]}
                    colsClassName="grid-cols-2 sm:grid-cols-3 gap-x-10 gap-y-6"
                  />
                </div>
              </div>

              {/* Számlázás */}
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400 mb-4 text-center">
                  Számlázás
                </p>
                <div className="mx-auto max-w-4xl">
                  <Grid
                    items={[...invoicingLive, ...invoicingPlanned]}
                    colsClassName="grid-cols-2 sm:grid-cols-3 gap-x-10 gap-y-6"
                  />
                </div>
              </div>
            </div>

            {/* Szállítás */}
            <div className="mb-10">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400 mb-4 text-center">
            Szállítás
          </p>
          <div className="mx-auto max-w-5xl">
            <Grid items={shippingLive} colsClassName="grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-x-10 gap-y-6" />
          </div>
        </div>

            {/* Subtle divider */}
            <div className="my-10 border-t border-slate-200/60" />

            {/* Group: AI */}
            <div className="mb-10">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400 mb-4 text-center">
            AI · Kommunikáció
          </p>
          <div className="mx-auto max-w-3xl">
            <Grid items={aiTools} colsClassName="grid-cols-2 sm:grid-cols-2 gap-x-10 gap-y-6" />
          </div>
        </div>

            {/* Divider */}
            <div className="my-10 border-t border-slate-200/60" />

            {/* Group: Google */}
            <div className="mb-10">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400 mb-4 text-center">
            Google · Analytics · Hirdetések
          </p>
          <div className="mx-auto max-w-4xl">
            <Grid items={google} colsClassName="grid-cols-2 sm:grid-cols-4 gap-x-10 gap-y-6" />
          </div>
        </div>

            <p className="text-center text-xs text-slate-500">
              Hiányzik valami?{' '}
              <a
                href="#demo"
                className="text-orange-600 hover:text-orange-700 font-semibold underline underline-offset-2"
              >
                Kérje az Öntől fontos integrációt →
              </a>
            </p>
          </div>
        </div>

      </div>
    </section>
  )
}
