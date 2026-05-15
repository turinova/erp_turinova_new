import Link from "next/link"
import Image from "next/image"
import Script from "next/script"
import { RevealOnLoad } from "@/components/site/RevealOnLoad"
import { RevealOnScroll } from "@/components/site/RevealOnScroll"
import {
  COMPANY,
  buildLocalBusinessJsonLd,
  formatPhoneDisplay,
  googleMapsDirectionsUrl,
  googleMapsEmbedUrl,
} from "@/lib/company"
import FaqAccordion from "@/components/szallitolada-keszites/FaqAccordion"
import {
  ProductMarquee,
  type MarqueeItem,
} from "@/components/barkacsaruhaz/ProductMarquee"

const VASALATMESTER_URL = "https://www.vasalatmester.hu"

export const metadata = {
  title:
    "Barkácsáruház Kecskemét. Bútorlap, vasalat, mosogató, csaptelep | Hírös-Ablak Kft.",
  description:
    "Faipari barkácsáruház és 500 m²-es bemutatóterem Kecskeméten. Bútorlap, vasalat (Blum, Kesseboehmer, Hettich), mosogatótálca, csaptelep, fogantyú, szerszám, ragasztó. Helyszíni lapszabászat és élzárás. 1996 óta, Mindszenti krt. 10. címen.",
  alternates: { canonical: "/barkacsaruhaz-kecskemet" },
  openGraph: {
    title:
      "Barkácsáruház Kecskemét. Bútorlap, vasalat, mosogató | Hírös-Ablak Kft.",
    description:
      "Faipari barkácsáruház és 500 m²-es bemutatóterem Kecskeméten. Bútorlap, vasalat, mosogatótálca, csaptelep, fogantyú, szerszám. 1996 óta.",
    url: "/barkacsaruhaz-kecskemet",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Barkácsáruház Kecskemét | Hírös-Ablak Kft.",
    description:
      "Faipari barkácsáruház és 500 m²-es bemutatóterem Kecskeméten. 1996 óta.",
  },
}

const ctaPrimaryDark =
  "inline-flex items-center justify-center rounded-full bg-[var(--color-brand)] px-6 py-3 text-base font-semibold text-[var(--color-brand-contrast)] hover:brightness-95 transition shadow-[0_8px_28px_rgba(151,29,37,0.35)]"
const ctaSecondaryDark =
  "inline-flex items-center justify-center rounded-full border border-white/30 bg-white/5 px-6 py-3 text-base font-semibold text-white hover:bg-white/10 transition"
const ctaPrimary =
  "inline-flex items-center justify-center rounded-full bg-[var(--color-brand)] px-6 py-3 text-base font-semibold text-[var(--color-brand-contrast)] hover:brightness-95"
const ctaSecondary =
  "inline-flex items-center justify-center rounded-full border border-black/15 bg-white px-6 py-3 text-base font-semibold text-black/85 hover:border-[var(--color-brand)] hover:text-[var(--color-brand)]"

function CtaPinGlyph({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12 21s-7-7.5-7-12a7 7 0 1 1 14 0c0 4.5-7 12-7 12Z" />
      <circle cx="12" cy="9" r="2.5" />
    </svg>
  )
}

function CheckBullet({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2.5">
      <span
        aria-hidden
        className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--color-brand)]/22 text-white ring-1 ring-white/15"
      >
        <svg
          className="h-3 w-3"
          fill="currentColor"
          viewBox="0 0 24 24"
          aria-hidden
        >
          <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
        </svg>
      </span>
      <span className="text-sm sm:text-base text-white/85 leading-snug">
        {children}
      </span>
    </li>
  )
}

function TrustStat({
  icon,
  headline,
  caption,
  headlineClassName,
}: {
  icon: React.ReactNode
  headline: React.ReactNode
  caption: string
  headlineClassName?: string
}) {
  const headCls =
    headlineClassName ??
    "text-2xl font-bold leading-none tracking-tight text-stone-900 md:text-3xl"
  return (
    <div className="flex flex-col items-center gap-2 px-3 py-2 text-center md:gap-2.5 md:border-r md:border-black/10 md:last:border-r-0 md:px-5">
      <span
        className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--color-brand)]/12 text-[var(--color-brand)] ring-1 ring-[var(--color-brand)]/18"
        aria-hidden
      >
        {icon}
      </span>
      <div className={headCls}>{headline}</div>
      <p className="max-w-[15rem] text-xs font-medium leading-snug text-black/55 md:text-sm">
        {caption}
      </p>
    </div>
  )
}

type CategoryItem = {
  title: string
  desc: string
  brands?: string
  icon: React.ReactNode
  /** Public path, e.g. /img/foo.png — shown on light gradient so transparent PNGs read well */
  imageSrc?: string
}

function CategoryCard({ title, desc, brands, icon, imageSrc }: CategoryItem) {
  return (
    <div className="group flex h-full flex-col overflow-hidden rounded-2xl border border-black/10 bg-white transition hover:border-[var(--color-brand)]/40 hover:shadow-[0_12px_32px_rgba(0,0,0,0.07)]">
      {/* Product image or placeholder header */}
      <div className="relative aspect-[4/3] overflow-hidden bg-gradient-to-br from-stone-100 via-stone-50 to-white">
        <div
          aria-hidden
          className="absolute inset-x-0 top-0 z-10 h-1 bg-[var(--color-brand)]/60 transition group-hover:bg-[var(--color-brand)]"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-[var(--color-brand)]/5 blur-2xl transition duration-500 group-hover:bg-[var(--color-brand)]/10"
        />
        {imageSrc ? (
          <Image
            src={imageSrc}
            alt={title}
            fill
            unoptimized
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            className="z-[1] bg-transparent object-contain p-5 sm:p-6 transition duration-500 group-hover:scale-[1.02]"
          />
        ) : (
          <>
            <div className="absolute inset-0 flex items-center justify-center text-[var(--color-brand)]/35 transition duration-500 group-hover:scale-110 group-hover:text-[var(--color-brand)]/60">
              <div className="h-20 w-20 sm:h-24 sm:w-24 [&>svg]:!h-full [&>svg]:!w-full">
                {icon}
              </div>
            </div>
            <span className="absolute right-2 top-2 z-10 inline-flex items-center rounded-full bg-white/85 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-black/50 backdrop-blur">
              Termékkép
            </span>
          </>
        )}
      </div>

      {/* Content */}
      <div className="flex flex-1 flex-col p-5">
        <div className="text-base font-semibold tracking-tight text-slate-900">
          {title}
        </div>
        <p className="mt-1.5 text-sm text-black/70 leading-relaxed">{desc}</p>
        {brands && (
          <p className="mt-3 text-xs text-black/55 leading-snug">{brands}</p>
        )}
      </div>
    </div>
  )
}

function GalleryPlaceholder({
  caption,
  hint,
  src,
  alt,
  ratio = "aspect-[4/3]",
}: {
  caption: string
  hint?: string
  src?: string
  alt?: string
  ratio?: string
}) {
  if (src) {
    return (
      <figure
        className={`relative ${ratio} overflow-hidden rounded-2xl border border-black/10 bg-stone-100`}
      >
        <Image
          src={src}
          alt={alt ?? caption}
          fill
          className="object-cover"
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
        />
        <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 via-black/50 to-transparent px-4 pb-4 pt-10">
          <div className="text-sm font-semibold text-white">{caption}</div>
          {hint && (
            <div className="mt-0.5 text-xs text-white/80">{hint}</div>
          )}
        </figcaption>
      </figure>
    )
  }

  return (
    <div
      className={`relative ${ratio} rounded-2xl overflow-hidden border border-black/10 bg-gradient-to-br from-stone-100 via-stone-50 to-white`}
    >
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 h-1 bg-[var(--color-brand)]"
      />
      <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--color-brand)]/10 text-[var(--color-brand)]">
          <svg
            className="w-6 h-6"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <rect x="3" y="5" width="18" height="14" rx="2" />
            <circle cx="8.5" cy="10" r="1.5" />
            <path d="M21 16l-5-5-9 9" />
          </svg>
        </div>
        <div className="mt-3 text-sm font-semibold text-slate-900">
          {caption}
        </div>
        {hint && (
          <div className="mt-1 text-xs text-black/55">{hint}</div>
        )}
      </div>
    </div>
  )
}

function BrandChipGroup({
  label,
  brands,
}: {
  label: string
  brands: string[]
}) {
  return (
    <div>
      <div className="text-xs font-semibold uppercase tracking-wide text-black/55">
        {label}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {brands.map((b) => (
          <span
            key={b}
            className="inline-flex items-center rounded-full border border-black/10 bg-white px-3.5 py-1.5 text-sm font-semibold text-slate-900"
          >
            {b}
          </span>
        ))}
      </div>
    </div>
  )
}

export default function BarkacsaruhazKecskemetPage() {
  const localBusinessJsonLd = buildLocalBusinessJsonLd()

  const hardwareStoreJsonLd = {
    "@context": "https://schema.org",
    "@type": "HardwareStore",
    name: `${COMPANY.brand} Faipari Barkácsáruház`,
    legalName: COMPANY.legalName,
    alternateName: [
      "Hírös-Ablak Faipari Áruház",
      "Hírös-Ablak Barkácsáruház",
      "Hírös-Ablak Kft. Barkácsáruház Kecskemét",
    ],
    url: `${COMPANY.website}/barkacsaruhaz-kecskemet`,
    image: `${COMPANY.website}/img/Hiros_ablak_logo.jpg`,
    foundingDate: COMPANY.foundingDate,
    description:
      "Faipari barkácsáruház és 500 m²-es bemutatóterem Kecskeméten. Bútorlap, munkalap, vasalat (Blum, Kesseboehmer, Hettich), mosogatótálca, csaptelep, fogantyú, szerszám, ragasztó. Helyszíni lapszabászat és élzárás.",
    address: {
      "@type": "PostalAddress",
      streetAddress: COMPANY.address.street,
      postalCode: COMPANY.address.postalCode,
      addressLocality: COMPANY.address.city,
      addressCountry: COMPANY.address.countryCode,
    },
    geo: {
      "@type": "GeoCoordinates",
      latitude: COMPANY.geo.latitude,
      longitude: COMPANY.geo.longitude,
    },
    areaServed: [
      { "@type": "City", name: "Kecskemét" },
      { "@type": "AdministrativeArea", name: "Bács-Kiskun vármegye" },
      { "@type": "Country", name: "Magyarország" },
    ],
    telephone: [
      formatPhoneDisplay(COMPANY.phones.primary),
      formatPhoneDisplay(COMPANY.phones.secondary),
    ],
    email: COMPANY.emails.central,
    sameAs: [VASALATMESTER_URL],
    paymentAccepted: ["Cash", "Credit Card", "Bank Transfer"],
    currenciesAccepted: "HUF",
    priceRange: "$$",
    openingHoursSpecification: [
      {
        "@type": "OpeningHoursSpecification",
        dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
        opens: COMPANY.hours.weekdays.opens,
        closes: COMPANY.hours.weekdays.closes,
      },
      {
        "@type": "OpeningHoursSpecification",
        dayOfWeek: "Saturday",
        opens: COMPANY.hours.saturday.opens,
        closes: COMPANY.hours.saturday.closes,
      },
    ],
  }

  const faqItems = [
    {
      q: "Mit talál a Hírös-Ablak barkácsáruházában?",
      a: "Bútorlapot és munkalapot (Egger, Kronospan, Kaindl), ABS élzárót, vasalatot (Blum, Kesseboehmer, Hettich), fiókrendszert, mosogatót és csaptelepet (Blanco, Quadron), fogantyút, gola profilt, LED bútorvilágítást, kéziszerszámot, csavart, ragasztót és szilikont (Soudal). OSB lap, MDF, rétegelt lemez, táblásított fenyő és bükk készletről vagy rövid beszerzési határidővel érhető el.",
    },
    {
      q: "Van helyszíni lapszabászat is az üzletben?",
      a: "Igen. A bolt mellett van a saját lapszabászatunk. A bútorlapot méretre vágjuk, élzárjuk, pánthelyet marunk. Mindent egy helyen intézhet.",
    },
    {
      q: "Mikor van nyitva a barkácsáruház?",
      a: `Hétfőtől péntekig ${COMPANY.hours.weekdays.opens}–${COMPANY.hours.weekdays.closes}, szombaton ${COMPANY.hours.saturday.opens}–${COMPANY.hours.saturday.closes}. Vasárnap zárva. Címünk: ${COMPANY.address.full}`,
    },
    {
      q: "Van webáruházuk is?",
      a: "Igen, a vasalatmester.hu címen. Vasalatot (Blum, Kesseboehmer, Hettich) és bútorkiegészítőt házhozszállítással. Bútorlap, munkalap, mosogató és csaptelep csak az üzletben kapható.",
    },
    {
      q: "Csak szakembereknek van az üzlet, vagy magánszemélyeknek is?",
      a: "Mindenkit szívesen látunk. Akár egyetlen fogantyúért jön, akár egy egész konyha alapanyagáért, ugyanúgy állunk hozzá.",
    },
    {
      q: "Milyen márkákat kaphat nálunk?",
      a: "Bútorlap: Egger, Kronospan, Kaindl, Kastamonu, Nettfront, Arkopa, Cleaf, Falco. Vasalat: Blum, Kesseboehmer, Hettich, Hranipex, Forest, Slim. Mosogatótálca és csaptelep: Blanco, Quadron, Strongsinks, Multikomplex, Ferro. Ragasztó és tömítő: Soudal, Hranipex. Szerszám: Neo Tools. Kiemelt beszállítói partnereink a Demos Trade és a Forest.",
    },
    {
      q: "Tudnak szállítani Kecskeméten kívülre?",
      a: "A Hírös-Ablak üzletben vásárolt bútorlapot, munkalapot és nagyobb tételeket személyesen Kecskeméten adjuk át, raklapra pakolva. Vasalatot és kisebb kiegészítőt a vasalatmester.hu webáruházban országosan is rendelhet; azt a webáruház fuvarral intézi.",
    },
    {
      q: "Bankkártyával lehet fizetni?",
      a: "Igen. Készpénzt, bankkártyát és cégeknek átutalást is elfogadunk.",
    },
    {
      q: "Az árak fel vannak tüntetve, vagy ajánlatra dolgoznak?",
      a: "A raktári termékeken ki van írva az ár, a webáruházban is. Lapszabászatra, élzárásra és nagyobb projektekre előzetes árajánlatot adunk, így nincs meglepetés.",
    },
  ]

  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqItems.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  }

  const directionsHref = googleMapsDirectionsUrl()
  const mapEmbed = googleMapsEmbedUrl()

  // Categories presented in store
  const categories: CategoryItem[] = [
    {
      title: "Bútorlap és munkalap",
      desc: "Forgács- és MDF lapok, postforming és kompakt munkalapok. Méretre vágva, élzárva.",
      brands: "Egger • Kronospan • Kaindl • Kastamonu • Nettfront",
      imageSrc: "/img/butor_bemutatot.jpeg",
      icon: (
        <svg
          className="w-5 h-5"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="3" y="5" width="18" height="14" rx="1.5" />
          <path d="M3 9h18M3 14h18" />
        </svg>
      ),
    },
    {
      title: "ABS élzáró",
      desc: "Több vastagság és szín. A bútorlap dekorhoz illesztve.",
      brands: "Egger • Kaindl • Kronospan",
      imageSrc: "/img/abs-elzaro.webp",
      icon: (
        <svg
          className="w-5 h-5"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M3 12h18" />
          <path d="M5 8h14M5 16h14" />
        </svg>
      ),
    },
    {
      title: "Bútorpánt és gázrugó",
      desc: "Csillapított pántok, Tip-On nyitás, gázrugók felnyíló és lenyíló frontokhoz.",
      brands: "Blum • Hettich",
      imageSrc: "/img/butorpant_gazrugoo.webp",
      icon: (
        <svg
          className="w-5 h-5"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="6" cy="12" r="2" />
          <circle cx="18" cy="12" r="2" />
          <path d="M8 12h8" />
        </svg>
      ),
    },
    {
      title: "Fiókrendszer",
      desc: "Duplafalú és fémoldalú fiókok soft-close és push-open kivitelben, golyós csúszóval.",
      brands: "Slim • Blum • StrongMax • FDS-PRO",
      imageSrc: "/img/fiokrendszer.png",
      icon: (
        <svg
          className="w-5 h-5"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="3" y="6" width="18" height="4" rx="1" />
          <rect x="3" y="14" width="18" height="4" rx="1" />
          <path d="M11 8h2M11 16h2" />
        </svg>
      ),
    },
    {
      title: "Bútorlábak",
      desc: "Különböző magasság és kivitel, szekrényekhez és pultokhoz.",
      brands: "Forest • Slim",
      imageSrc: "/img/butorlabak.JPG",
      icon: (
        <svg
          className="w-5 h-5"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M4 4h8v8H4zM12 12h8v8h-8z" />
          <path d="M12 4h8M4 12v8" />
        </svg>
      ),
    },
    {
      title: "Mosogatótálca",
      desc: "Gránit, rozsdamentes acél és kompozit mosogatótálcák több tucat kiállított mintával.",
      brands: "Blanco • Quadron • Strongsinks • Multikomplex",
      imageSrc: "/img/mosogatotalca.webp",
      icon: (
        <svg
          className="w-5 h-5"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="3" y="8" width="18" height="10" rx="1" />
          <path d="M12 4v4M10 6h4" />
        </svg>
      ),
    },
    {
      title: "Csaptelep",
      desc: "Konyhai és mosdó csaptelepek, kihúzható zuhanyfejes változatban is.",
      brands: "Blanco • Ferro",
      imageSrc: "/img/csaptelep.webp",
      icon: (
        <svg
          className="w-5 h-5"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 4v6" />
          <path d="M8 10h8a2 2 0 012 2v0H6a2 2 0 012-2z" />
          <path d="M12 12v8" />
          <path d="M9 20h6" />
        </svg>
      ),
    },
    {
      title: "Fogantyú és gola profil",
      desc: "Front- és élfogantyúk, gola rendszerek, push-open megoldások, fogasok.",
      imageSrc: "/img/fogantyu.png",
      icon: (
        <svg
          className="w-5 h-5"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="4" y="9" width="16" height="6" rx="2" />
        </svg>
      ),
    },
    {
      title: "LED bútorvilágítás",
      desc: "LED profilok, borítók, tápegységek, mozgásérzékelők és kapcsolók szekrény- és pultvilágításhoz.",
      imageSrc: "/img/ledbutorvialgitas.webp",
      icon: (
        <svg
          className="w-5 h-5"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 2v3M5 5l2 2M19 5l-2 2M3 12h3M18 12h3" />
          <circle cx="12" cy="13" r="4" />
          <path d="M10 19h4M10 22h4" />
        </svg>
      ),
    },
    {
      title: "Csavar és kötőelem",
      desc: "Facsavar, konfirmátor, tipli, lamelló, sarokvas, függesztő vasalat és összekötő lemez.",
      imageSrc: "/img/csavar.webp",
      icon: (
        <svg
          className="w-5 h-5"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M14 4l-2 2-6 6 2 2 6-6 2-2z" />
          <path d="M12 12l-4 4-2-2 4-4" />
          <path d="M16 8l4 4" />
        </svg>
      ),
    },
    {
      title: "Ragasztó, szilikon, tömítő",
      desc: "Bútorragasztó, fa- és univerzális ragasztó, szilikon és akril tömítő.",
      brands: "Soudal • Hranipex",
      imageSrc: "/img/ragaszto.webp",
      icon: (
        <svg
          className="w-5 h-5"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M9 3h6v4l2 3v9a2 2 0 01-2 2H9a2 2 0 01-2-2v-9l2-3V3z" />
          <path d="M9 7h6" />
        </svg>
      ),
    },
    {
      title: "Kéziszerszám és kisgép",
      desc: "Fúrógép, csiszoló, fűrészgép, fúrószárak, mérőeszközök kezdőtől profi szintig.",
      brands: "Neo Tools",
      imageSrc: "/img/keziszerszam.webp",
      icon: (
        <svg
          className="w-5 h-5"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M14 4l6 6-3 3-6-6z" />
          <path d="M11 7l-7 7v6h6l7-7" />
        </svg>
      ),
    },
  ]

  // Marquee tile icon factory: makes the SVG fill the placeholder area
  const tileIcon = (paths: React.ReactNode) => (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-full w-full"
    >
      {paths}
    </svg>
  )

  // Row 1, scrolls left
  const marqueeRow1: MarqueeItem[] = [
    {
      label: "Állítható bútorlap, polc",
      brand: "Egger",
      imageSrc: "/img/Allithato_butorlab.webp",
      icon: tileIcon(
        <>
          <rect x="3" y="5" width="18" height="14" rx="1.5" />
          <path d="M3 9h18M3 14h18" />
        </>,
      ),
    },
    {
      label: "Gardrób vasalatok",
      imageSrc: "/img/gardrob_vasalatok.webp",
      icon: tileIcon(
        <>
          <path d="M3 8h18l-2 4H5z" />
          <path d="M5 12v6h14v-6" />
        </>,
      ),
    },
    {
      label: "CLIP top BLUMOTION pánt",
      brand: "Blum",
      imageSrc: "/img/CLIP_top_BLUMOTION_pant.webp",
      icon: tileIcon(
        <>
          <circle cx="6" cy="12" r="2.4" />
          <circle cx="18" cy="12" r="2.4" />
          <path d="M8.4 12h7.2" />
          <path d="M12 8v8" />
        </>,
      ),
    },
    {
      label: "Hulladékgyűjtő, kihúzható",
      brand: "Blanco",
      imageSrc: "/img/Blanco_Hulladektarolo.webp",
      icon: tileIcon(
        <>
          <path d="M4 4h8v8H4z" />
          <path d="M12 12c4 0 8 3 8 8H12z" />
        </>,
      ),
    },
    {
      label: "SUBLIME mosogatótálca",
      brand: "Blanco",
      imageSrc: "/img/blanco_sublime_u-500.webp",
      icon: tileIcon(
        <>
          <rect x="3" y="8" width="18" height="11" rx="1.5" />
          <path d="M12 4v4M10 6h4" />
          <circle cx="12" cy="14" r="1" />
        </>,
      ),
    },
    {
      label: "Kihúzható csaptelep",
      brand: "Blanco",
      imageSrc: "/img/kihuzhato_csaptelep.png",
      icon: tileIcon(
        <>
          <path d="M12 3v6" />
          <path d="M7 9h10a2 2 0 012 2H5a2 2 0 012-2z" />
          <path d="M12 11v9" />
          <path d="M9 20h6" />
        </>,
      ),
    },
    {
      label: "ABS élzáró 22 mm",
      brand: "Egger",
      icon: tileIcon(
        <>
          <rect x="3" y="10" width="18" height="4" rx="1" />
          <path d="M6 10v4M10 10v4M14 10v4M18 10v4" />
        </>,
      ),
    },
    {
      label: "Tolóajtó rendszer",
      brand: "Hettich",
      icon: tileIcon(
        <>
          <rect x="3" y="6" width="9" height="12" rx="1" />
          <rect x="12" y="6" width="9" height="12" rx="1" />
          <path d="M3 6h18" />
        </>,
      ),
    },
  ]

  // Row 2, scrolls right
  const marqueeRow2: MarqueeItem[] = [
    {
      label: "TANDEMBOX fiók, evőeszköztartó",
      brand: "Blum",
      imageSrc: "/img/Evoeszkoztarto.webp",
      icon: tileIcon(
        <>
          <rect x="3" y="6" width="18" height="5" rx="1" />
          <rect x="3" y="13" width="18" height="5" rx="1" />
          <path d="M11 8.5h2M11 15.5h2" />
        </>,
      ),
    },
    {
      label: "Kihúzható kosár",
      brand: "Hranipex",
      imageSrc: "/img/Hranipex_kihuzhato_kosar.webp",
      icon: tileIcon(
        <>
          <path d="M3 21V3h18" />
          <path d="M7 21v-7h7" />
          <path d="M11 14l4-4" />
        </>,
      ),
    },
    {
      label: "Univerzális tömítő",
      brand: "Soudal",
      imageSrc: "/img/univerzalis_tomito.webp",
      icon: tileIcon(
        <>
          <path d="M9 3h6v4l2 3v9a2 2 0 01-2 2H9a2 2 0 01-2-2v-9l2-3V3z" />
          <path d="M9 7h6" />
          <path d="M11 14h2" />
        </>,
      ),
    },
    {
      label: "Fogasok, akasztók",
      imageSrc: "/img/Fogasok.png",
      icon: tileIcon(
        <>
          <rect x="3" y="9" width="18" height="6" rx="3" />
          <path d="M7 12h10" />
        </>,
      ),
    },
    {
      label: "Ruhalift, ruhatartó",
      brand: "Hranipex",
      imageSrc: "/img/Hranipex_ruhalift.png",
      icon: tileIcon(
        <>
          <path d="M4 20L20 4" />
          <path d="M4 20h6" />
          <path d="M20 4v6" />
          <path d="M8 16l8-8" strokeDasharray="2 2" />
        </>,
      ),
    },
    {
      label: "Konfirmátor csavar",
      brand: "Forest",
      imageSrc: "/img/konfirmator.png",
      icon: tileIcon(
        <>
          <circle cx="12" cy="6" r="2.5" />
          <path d="M12 8.5V20" />
          <path d="M9 11h6M9 14h6M9 17h6" />
        </>,
      ),
    },
    {
      label: "Akkus fúró 18 V",
      brand: "Neo Tools",
      icon: tileIcon(
        <>
          <rect x="3" y="9" width="11" height="6" rx="1" />
          <path d="M14 12h4l2 2v-4z" />
          <rect x="5" y="15" width="5" height="5" rx="1" />
        </>,
      ),
    },
    {
      label: "Gola profil J",
      brand: "Slim",
      icon: tileIcon(
        <>
          <path d="M4 4h16v6h-4v10H4z" />
          <path d="M4 10h12" />
        </>,
      ),
    },
  ]

  return (
    <div className="relative">
      <Script
        id="jsonld-localbusiness-barkacsaruhaz"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(localBusinessJsonLd) }}
      />
      <Script
        id="jsonld-hardwarestore-barkacsaruhaz"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(hardwareStoreJsonLd) }}
      />
      <Script
        id="jsonld-faq-barkacsaruhaz"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />

      <RevealOnLoad>
        {/* HERO — portrait image: split on lg, stacked card on smaller screens */}
        <section className="relative isolate overflow-hidden bg-stone-950 text-white">
          <div className="mx-auto max-w-7xl lg:grid lg:grid-cols-12 lg:min-h-[min(640px,88vh)] lg:items-stretch">
            <div className="relative z-10 px-4 pb-12 pt-12 sm:px-6 sm:pb-14 sm:pt-16 lg:col-span-7 lg:flex lg:flex-col lg:justify-center lg:px-8 lg:py-16 xl:py-20">
              <div
                aria-hidden
                className="pointer-events-none absolute -top-24 left-0 h-[460px] w-[460px] rounded-full opacity-90 sm:h-[520px] sm:w-[520px] lg:-left-12"
                style={{
                  background:
                    "radial-gradient(circle, rgba(151,29,37,0.34) 0%, transparent 68%)",
                }}
              />

              <div className="relative max-w-3xl lg:max-w-2xl">
                <p className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-3 py-1 text-xs text-white/85 backdrop-blur">
                  Kecskemét · Mindszenti krt. 10. · 1996 óta
                </p>

                <h1 className="mt-5 text-balance text-4xl font-semibold tracking-tight text-white md:text-5xl">
                  Faipari barkácsáruház Kecskeméten
                </h1>

                <p className="mt-3 text-lg text-white/80 md:text-xl">
                  500 m²-es bemutatóterem, lapszabászattal egy telephelyen
                </p>

                <div
                  aria-hidden
                  className="mt-4 h-1.5 w-24 rounded-full bg-[var(--color-brand)]"
                />

                <p className="mt-5 max-w-2xl text-pretty text-base text-white/85 md:text-lg">
                  Bútorlap, vasalat, mosogató, szerszám: ha elakad, segítünk
                  választani.
                </p>

                <ul className="mt-6 grid max-w-xl gap-2.5">
                  <CheckBullet>
                    500 m²-es bemutatóterem, 100 feletti minta, élőben
                    megtekinthető.
                  </CheckBullet>
                  <CheckBullet>Lapszabászat és élzárás helyben.</CheckBullet>
                  <CheckBullet>Több mint 30 márka, sok tétel készletről.</CheckBullet>
                  <CheckBullet>
                    Ha nem tudja pontosan, mire van szüksége, együtt
                    kitaláljuk a megoldást.
                  </CheckBullet>
                </ul>

                <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-center">
                  <a
                    href={directionsHref}
                    target="_blank"
                    rel="noreferrer"
                    className={ctaPrimaryDark}
                  >
                    Útvonaltervezés
                  </a>
                  <a
                    href={VASALATMESTER_URL}
                    target="_blank"
                    rel="noreferrer"
                    className={ctaSecondaryDark}
                  >
                    Webáruház: vasalatmester.hu
                  </a>
                </div>
              </div>

              <div className="relative mx-auto mt-10 aspect-[3/4] w-full max-w-md overflow-hidden rounded-2xl border border-white/10 shadow-[0_24px_60px_rgba(0,0,0,0.45)] lg:hidden">
                <Image
                  src="/img/bemutato_hero.jpg"
                  alt="Hírös-Ablak bemutatótere és faipari barkácsáruház, Kecskemét"
                  fill
                  priority
                  sizes="(max-width: 1024px) 90vw, 0vw"
                  className="object-cover object-[center_22%]"
                />
              </div>
            </div>

            <div className="relative hidden min-h-[min(360px,42vh)] lg:col-span-5 lg:block lg:min-h-full">
              <Image
                src="/img/bemutato_hero.jpg"
                alt="Hírös-Ablak bemutatótere és faipari barkácsáruház, Kecskemét"
                fill
                sizes="(max-width: 1024px) 0vw, 42vw"
                className="object-cover object-[52%_center] lg:rounded-l-3xl"
              />
              <div
                aria-hidden
                className="pointer-events-none absolute inset-y-0 left-0 z-10 w-16 bg-gradient-to-r from-stone-950 via-stone-950/55 to-transparent sm:w-24"
              />
            </div>
          </div>
        </section>

        {/* TRUST STRIP — stat blokk: nagy szám / cím + alcím + ikon */}
        <section className="border-b border-black/10 bg-stone-wash py-8 md:py-10">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-4 md:gap-x-0 md:gap-y-0">
              <TrustStat
                icon={
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden
                  >
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                    <line x1="16" x2="16" y1="2" y2="6" />
                    <line x1="8" x2="8" y1="2" y2="6" />
                    <line x1="3" x2="21" y1="10" y2="10" />
                  </svg>
                }
                headline={
                  <span className="text-[var(--color-brand)]">1996</span>
                }
                caption="Óta Kecskeméten"
              />
              <TrustStat
                icon={
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden
                  >
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                    <path d="M3 9h18" />
                    <path d="M9 21V9" />
                  </svg>
                }
                headline="500 m²"
                caption="Bemutatóterem"
              />
              <TrustStat
                icon={
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden
                  >
                    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                    <polyline points="9 22 9 12 15 12 15 22" />
                  </svg>
                }
                headline="Barkácsáruház és lapszabászat"
                caption="Egy helyen minden."
                headlineClassName="text-base font-bold leading-tight tracking-tight text-stone-900 sm:text-lg md:text-xl"
              />
              <TrustStat
                icon={
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden
                  >
                    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                    <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
                    <line x1="12" y1="22.08" x2="12" y2="12" />
                  </svg>
                }
                headline="Széles választék"
                caption="Készletről vagy rövid beszerzési határidővel"
              />
            </div>
          </div>
        </section>

        {/* CATEGORIES */}
        <section className="bg-white py-12 md:py-16">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <RevealOnScroll>
              <div className="text-center max-w-3xl mx-auto">
                <p className="text-xs font-semibold uppercase tracking-wide text-black/55">
                  Egy telephelyen
                </p>
                <h2 className="mt-2 text-3xl md:text-4xl font-semibold tracking-tight text-slate-900">
                  Bútorlap, vasalat, mosogató, szerszám
                </h2>
                <div
                  aria-hidden
                  className="mt-3 h-1.5 w-20 rounded-full bg-[var(--color-brand)] mx-auto"
                />
                <p className="mt-4 text-base text-black/70">
                  Nem kell három boltot végigjárni: bútorlap, vasalat, mosogató és
                  szerszám egy helyen, Kecskeméten. A kollégák szívesen segítenek
                  kiválasztani.
                </p>
              </div>
            </RevealOnScroll>

            <RevealOnScroll delay={0.1} className="mt-10">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {categories.map((c) => (
                  <CategoryCard
                    key={c.title}
                    title={c.title}
                    desc={c.desc}
                    brands={c.brands}
                    icon={c.icon}
                    imageSrc={c.imageSrc}
                  />
                ))}
              </div>
            </RevealOnScroll>
          </div>
        </section>

        {/* PRODUCT MARQUEE */}
        <section className="relative overflow-hidden bg-slate-900 py-12 md:py-16">
          <div
            aria-hidden
            className="pointer-events-none absolute -top-32 left-1/2 -z-0 h-[420px] w-[820px] -translate-x-1/2 rounded-full"
            style={{
              background:
                "radial-gradient(circle, rgba(151,29,37,0.18) 0%, transparent 65%)",
            }}
          />
          <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <RevealOnScroll>
              <div className="mx-auto max-w-3xl text-center">
                <p className="text-xs font-semibold uppercase tracking-wide text-white/55">
                  Termékek
                </p>
                <h2 className="mt-2 text-3xl md:text-4xl font-semibold tracking-tight text-white">
                  Néhány tétel a kínálatunkból
                </h2>
                <div
                  aria-hidden
                  className="mx-auto mt-3 h-1.5 w-20 rounded-full bg-[var(--color-brand)]"
                />
                <p className="mt-4 text-base text-white/70">
                  Széles választék készletről vagy rövid beszerzési határidővel. A
                  bemutatóteremben élőben is megnézheti, kézbe veheti.
                </p>
              </div>
            </RevealOnScroll>
          </div>

          <RevealOnScroll delay={0.1} className="mt-10 space-y-3 sm:space-y-4">
            <ProductMarquee
              items={marqueeRow1}
              direction="left"
              duration={48}
              theme="dark"
              maskFromClass="from-slate-900"
              ariaLabel="Termékek, balra görgő"
            />
            <ProductMarquee
              items={marqueeRow2}
              direction="right"
              duration={54}
              theme="dark"
              maskFromClass="from-slate-900"
              ariaLabel="Termékek, jobbra görgő"
            />
          </RevealOnScroll>

          <div className="relative mx-auto mt-10 max-w-7xl px-4 sm:px-6 lg:px-8">
            <RevealOnScroll delay={0.15}>
              <p className="text-center text-xs text-white/45">
                A képek illusztrációk. A pontos kínálatért és aktuális
                készletért keressen minket telefonon vagy személyesen.
              </p>
            </RevealOnScroll>
          </div>
        </section>

        {/* SHOWROOM GALLERY */}
        <section className="bg-stone-wash py-12 md:py-16 border-y border-black/10">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <RevealOnScroll>
              <div className="text-center max-w-3xl mx-auto">
                <p className="text-xs font-semibold uppercase tracking-wide text-black/55">
                  Bemutatóterem
                </p>
                <h2 className="mt-2 text-3xl md:text-4xl font-semibold tracking-tight text-slate-900">
                  Jöjjön be Kecskemétre, nézze meg élőben
                </h2>
                <div
                  aria-hidden
                  className="mt-3 h-1.5 w-20 rounded-full bg-[var(--color-brand)] mx-auto"
                />
                <p className="mt-4 text-base text-black/70">
                  Vasalat, fogantyú, mosogató és csaptelep minták az üzletben.
                  Bútorlap-dekorokat kézbe vehet. Nyitvatartásban kollégák
                  segítenek a választásban.
                </p>
              </div>
            </RevealOnScroll>

            <RevealOnScroll delay={0.1} className="mt-10">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <GalleryPlaceholder
                  src="/img/butor_bemutatot.jpeg"
                  alt="Bútorlap minta fal a Hírös-Ablak bemutatóteremben"
                  caption="Bútorlap minta fal"
                  hint="Egger, Kronospan, Kaindl és további márkák színmintái"
                />
                <GalleryPlaceholder
                  src="/img/ragasztok.JPG"
                  alt="Ragasztók és szilikonok a Hírös-Ablak barkácsáruházban"
                  caption="Ragasztók, szilikonok"
                  hint="Bútor- és ipari ragasztók, tömítők, szilikonok raktárról"
                />
                <GalleryPlaceholder
                  src="/img/mosogatotalcak.JPG"
                  alt="Mosogatótálcák a Hírös-Ablak bemutatóteremben"
                  caption="Mosogatótálcák"
                  hint="Blanco, Quadron, Strongsinks kiállított minták"
                />
                <GalleryPlaceholder
                  src="/img/fogantyuk.JPG"
                  alt="Fogantyúk és gola profilok a bemutatóteremben"
                  caption="Fogantyúk és gola profilok"
                  hint="Széles választék, sok minta egy helyen"
                />
                <GalleryPlaceholder
                  src="/img/butorlabak.JPG"
                  alt="Bútorlábak a Hírös-Ablak barkácsáruházban"
                  caption="Bútorlábak"
                  hint="Különböző magasság és kivitel, raktárról"
                />
                <GalleryPlaceholder
                  src="/img/IMG_8377.JPG"
                  alt="A Hírös-Ablak barkácsáruház bejárata, Mindszenti krt. 10., Kecskemét"
                  caption="Bejárat, Mindszenti krt. 10."
                  hint="Saját parkoló az üzlet előtt"
                />
              </div>
            </RevealOnScroll>

            <RevealOnScroll delay={0.15}>
              <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
                <a
                  href={directionsHref}
                  target="_blank"
                  rel="noreferrer"
                  className={ctaPrimary}
                >
                  Útvonaltervezés
                </a>
                <a
                  href={`tel:${COMPANY.phones.primary}`}
                  className={ctaSecondary}
                >
                  Hívás: {formatPhoneDisplay(COMPANY.phones.primary)}
                </a>
              </div>
            </RevealOnScroll>
          </div>
        </section>

        {/* BRAND WALL */}
        <section className="bg-white py-12 md:py-16">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <RevealOnScroll>
              <div className="text-center max-w-3xl mx-auto">
                <p className="text-xs font-semibold uppercase tracking-wide text-black/55">
                  Márkák
                </p>
                <h2 className="mt-2 text-3xl md:text-4xl font-semibold tracking-tight text-slate-900">
                  Megbízható márkák, készletről
                </h2>
                <div
                  aria-hidden
                  className="mt-3 h-1.5 w-20 rounded-full bg-[var(--color-brand)] mx-auto"
                />
                <p className="mt-4 text-base text-black/70">
                  A felsorolt márkák készletről kaphatók, vagy rövid beszerzési
                  határidővel rendelhetők. Kiemelt beszállítóink a Demos Trade és
                  a Forest; a kínálat rendszeresen frissül.
                </p>
              </div>
            </RevealOnScroll>

            <RevealOnScroll delay={0.1} className="mt-10">
              <div className="grid gap-8 lg:grid-cols-2">
                <BrandChipGroup
                  label="Bútorlap és munkalap"
                  brands={[
                    "Egger",
                    "Kronospan",
                    "Kaindl",
                    "Kastamonu",
                    "Nettfront",
                    "Arkopa",
                    "Cleaf",
                    "Falco",
                  ]}
                />
                <BrandChipGroup
                  label="Vasalat"
                  brands={[
                    "Blum",
                    "Kesseboehmer",
                    "Hettich",
                    "Hranipex",
                    "Forest",
                    "Slim",
                  ]}
                />
                <BrandChipGroup
                  label="Mosogatótálca és csaptelep"
                  brands={[
                    "Blanco",
                    "Quadron",
                    "Strongsinks",
                    "Multikomplex",
                    "Ferro",
                  ]}
                />
                <BrandChipGroup
                  label="Ragasztó, szilikon, szerszám"
                  brands={["Soudal", "Hranipex", "Neo Tools"]}
                />
              </div>
            </RevealOnScroll>
          </div>
        </section>

        {/* HELYSZÍNI LAPSZABÁSZAT CROSS-SELL */}
        <section className="bg-stone-wash py-12 md:py-16 border-y border-black/10">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="grid gap-8 lg:grid-cols-12 lg:items-center">
              <div className="lg:col-span-6">
                <RevealOnScroll>
                  <p className="text-xs font-semibold uppercase tracking-wide text-black/55">
                    Helyszíni szolgáltatás
                  </p>
                  <h2 className="mt-2 text-3xl md:text-4xl font-semibold tracking-tight text-slate-900">
                    Lapszabászat és élzárás helyben
                  </h2>
                  <div
                    aria-hidden
                    className="mt-3 h-1.5 w-20 rounded-full bg-[var(--color-brand)]"
                  />
                  <p className="mt-5 text-base text-black/75 leading-relaxed">
                    A barkácsáruház és a lapszabászat egy telephelyen.
                    Kiválasztja a bútorlapot, megadja a méreteket, és a
                    megbeszélt határidőre kész, méretre vágva, élzárva. Több száz
                    bútorlap és munkalap minta a bemutatótermünkben.
                  </p>
                  <ul className="mt-5 grid gap-2.5">
                    <li className="flex items-start gap-2.5">
                      <span
                        aria-hidden
                        className="mt-0.5 inline-flex w-5 h-5 rounded-full bg-[var(--color-brand)]/10 text-[var(--color-brand)] items-center justify-center shrink-0"
                      >
                        <svg
                          className="w-3 h-3"
                          fill="currentColor"
                          viewBox="0 0 24 24"
                          aria-hidden
                        >
                          <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                        </svg>
                      </span>
                      <span className="text-sm text-black/80 leading-snug">
                        Optimalizált táblafelhasználás, minimális hulladékkal
                      </span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <span
                        aria-hidden
                        className="mt-0.5 inline-flex w-5 h-5 rounded-full bg-[var(--color-brand)]/10 text-[var(--color-brand)] items-center justify-center shrink-0"
                      >
                        <svg
                          className="w-3 h-3"
                          fill="currentColor"
                          viewBox="0 0 24 24"
                          aria-hidden
                        >
                          <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                        </svg>
                      </span>
                      <span className="text-sm text-black/80 leading-snug">
                        ABS, élfólia, élléc és élfurnér kínálat a lap
                        dekorhoz illesztve
                      </span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <span
                        aria-hidden
                        className="mt-0.5 inline-flex w-5 h-5 rounded-full bg-[var(--color-brand)]/10 text-[var(--color-brand)] items-center justify-center shrink-0"
                      >
                        <svg
                          className="w-3 h-3"
                          fill="currentColor"
                          viewBox="0 0 24 24"
                          aria-hidden
                        >
                          <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                        </svg>
                      </span>
                      <span className="text-sm text-black/80 leading-snug">
                        Pánthelymarás, szögvágás, duplongolás és egyedi
                        megoldások
                      </span>
                    </li>
                  </ul>
                  <div className="mt-7 flex flex-wrap gap-3">
                    <Link
                      href="/szolgaltatasok/lapszabaszat-es-elzaras"
                      className={ctaPrimary}
                    >
                      Tovább a lapszabászathoz
                    </Link>
                    <Link
                      href="/szolgaltatasok/online-lapszabaszat"
                      className={ctaSecondary}
                    >
                      Online árajánlat
                    </Link>
                  </div>
                </RevealOnScroll>
              </div>

              <div className="lg:col-span-6">
                <RevealOnScroll delay={0.1}>
                  <div className="relative aspect-[4/3] rounded-2xl overflow-hidden border border-black/10">
                    <Image
                      src="/img/BIESSE_SELCO_10660_oriz.jpg"
                      alt="Lapszabászati gép a Hírös-Ablak üzemében"
                      fill
                      sizes="(max-width: 1024px) 100vw, 50vw"
                      className="object-cover"
                    />
                  </div>
                </RevealOnScroll>
              </div>
            </div>
          </div>
        </section>

        {/* WEBSHOP BRIDGE */}
        <section className="bg-white py-12 md:py-16">
          <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
            <RevealOnScroll>
              <div className="rounded-3xl border border-black/10 bg-gradient-to-br from-stone-50 via-white to-stone-50 p-8 md:p-10">
                <div className="grid gap-8 lg:grid-cols-12 lg:items-center">
                  <div className="lg:col-span-4">
                    <a
                      href={VASALATMESTER_URL}
                      target="_blank"
                      rel="noreferrer"
                      aria-label="vasalatmester.hu webáruház megnyitása új lapon"
                      className="group relative flex aspect-[16/9] items-center justify-center overflow-hidden rounded-xl border border-black/10 bg-white p-6 transition hover:border-[var(--color-brand)]/35 hover:shadow-md"
                    >
                      <Image
                        src="/img/vasalatmester-logo.png"
                        alt="Vasalatmester webáruház logója"
                        fill
                        sizes="(max-width: 1024px) 100vw, 320px"
                        className="object-contain p-4 transition duration-300 group-hover:scale-[1.02]"
                        unoptimized
                      />
                    </a>
                    <p className="mt-2 text-center text-xs text-black/50">
                      vasalatmester.hu
                    </p>
                  </div>
                  <div className="lg:col-span-8">
                    <p className="text-xs font-semibold uppercase tracking-wide text-black/55">
                      Webáruházunk
                    </p>
                    <h2 className="mt-2 text-2xl md:text-3xl font-semibold tracking-tight text-slate-900">
                      Vasalat webshopból, házhoz
                    </h2>
                    <p className="mt-4 text-base text-black/75 leading-relaxed">
                      <strong className="font-semibold text-slate-900">
                        Webshop (vasalatmester.hu):
                      </strong>{" "}
                      vasalat (Blum, Kesseboehmer, Hettich), fiókrendszer és
                      bútorkiegészítő országos házhozszállítással.{" "}
                      <strong className="font-semibold text-slate-900">
                        Üzletben (Kecskemét):
                      </strong>{" "}
                      bútorlap, munkalap, mosogató és csaptelep, személyes
                      átvétellel.
                    </p>
                    <div className="mt-6 flex flex-wrap gap-3">
                      <a
                        href={VASALATMESTER_URL}
                        target="_blank"
                        rel="noreferrer"
                        className={ctaPrimary}
                      >
                        Megnézem a webáruházat
                      </a>
                      <a
                        href={`tel:${COMPANY.phones.primary}`}
                        className={`${ctaSecondary} flex-col gap-0.5 py-3.5`}
                      >
                        <span className="text-sm font-medium text-black/70">
                          Telefonos segítség
                        </span>
                        <span className="text-base font-semibold tabular-nums text-black/90">
                          {formatPhoneDisplay(COMPANY.phones.primary)}
                        </span>
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            </RevealOnScroll>
          </div>
        </section>

        {/* MAP + LOCAL SEO */}
        <section className="bg-stone-wash py-12 md:py-16 border-y border-black/10">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <RevealOnScroll>
              <div className="text-center max-w-3xl mx-auto">
                <p className="text-xs font-semibold uppercase tracking-wide text-black/55">
                  Hol talál minket
                </p>
                <h2 className="mt-2 text-3xl md:text-4xl font-semibold tracking-tight text-slate-900">
                  Kecskemét, Mindszenti krt. 10.
                </h2>
                <div
                  aria-hidden
                  className="mt-3 h-1.5 w-20 rounded-full bg-[var(--color-brand)] mx-auto"
                />
              </div>
            </RevealOnScroll>

            <RevealOnScroll delay={0.1} className="mt-10">
              <div className="grid gap-6 lg:grid-cols-12 lg:gap-8">
                {/* Map */}
                <div className="lg:col-span-7">
                  <div className="overflow-hidden rounded-2xl border border-black/10 bg-white">
                    <iframe
                      title="Hírös-Ablak Faipari Áruház, Google Maps"
                      src={mapEmbed}
                      className="block h-full w-full"
                      style={{ border: 0, minHeight: 480 }}
                      loading="lazy"
                      referrerPolicy="no-referrer-when-downgrade"
                      allowFullScreen
                    />
                  </div>
                </div>

                {/* Info */}
                <div className="lg:col-span-5">
                  <div className="rounded-2xl border border-black/10 bg-white p-6 md:p-7 h-full">
                    <div className="text-xs font-semibold uppercase tracking-wide text-black/55">
                      Cím
                    </div>
                    <div className="mt-1 text-lg font-semibold text-slate-900">
                      {COMPANY.address.full}
                    </div>

                    <hr className="my-5 border-t border-black/5" />

                    <div className="text-xs font-semibold uppercase tracking-wide text-black/55">
                      Telefon
                    </div>
                    <div className="mt-2 grid gap-1.5">
                      <a
                        className="text-base font-semibold text-slate-900 underline underline-offset-4 hover:text-[var(--color-brand)]"
                        href={`tel:${COMPANY.phones.primary}`}
                      >
                        {formatPhoneDisplay(COMPANY.phones.primary)}
                      </a>
                      <a
                        className="text-base font-semibold text-slate-900 underline underline-offset-4 hover:text-[var(--color-brand)]"
                        href={`tel:${COMPANY.phones.secondary}`}
                      >
                        {formatPhoneDisplay(COMPANY.phones.secondary)}
                      </a>
                    </div>
                    <div className="mt-2 text-xs text-black/55">
                      Nyitvatartási időben mindkét szám hívható.
                    </div>

                    <hr className="my-5 border-t border-black/5" />

                    <div className="text-xs font-semibold uppercase tracking-wide text-black/55">
                      E-mail
                    </div>
                    <a
                      className="mt-1 block text-sm font-semibold text-slate-900 underline underline-offset-4 hover:text-[var(--color-brand)]"
                      href={`mailto:${COMPANY.emails.central}`}
                    >
                      {COMPANY.emails.central}
                    </a>

                    <hr className="my-5 border-t border-black/5" />

                    <div className="text-xs font-semibold uppercase tracking-wide text-black/55">
                      Nyitvatartás
                    </div>
                    <dl className="mt-2 grid gap-1.5 text-sm">
                      <div className="flex items-baseline justify-between">
                        <dt className="text-black/65">Hétfő–Péntek</dt>
                        <dd className="font-semibold text-slate-900">
                          {COMPANY.hours.weekdays.opens}–
                          {COMPANY.hours.weekdays.closes}
                        </dd>
                      </div>
                      <div className="flex items-baseline justify-between">
                        <dt className="text-black/65">Szombat</dt>
                        <dd className="font-semibold text-slate-900">
                          {COMPANY.hours.saturday.opens}–
                          {COMPANY.hours.saturday.closes}
                        </dd>
                      </div>
                      <div className="flex items-baseline justify-between">
                        <dt className="text-black/65">Vasárnap</dt>
                        <dd className="font-semibold text-slate-900">Zárva</dd>
                      </div>
                    </dl>

                    <div className="mt-6 flex flex-wrap gap-2">
                      <a
                        href={directionsHref}
                        target="_blank"
                        rel="noreferrer"
                        className={ctaPrimary}
                      >
                        Útvonaltervezés
                      </a>
                      <a
                        href={`tel:${COMPANY.phones.primary}`}
                        className={ctaSecondary}
                      >
                        Hívás
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            </RevealOnScroll>
          </div>
        </section>

        {/* FAQ */}
        <section className="bg-white py-12 md:py-16">
          <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
            <RevealOnScroll>
              <div className="text-center">
                <h2 className="text-3xl md:text-4xl font-semibold tracking-tight text-slate-900">
                  Gyakori kérdések
                </h2>
                <div
                  aria-hidden
                  className="mt-3 h-1.5 w-20 rounded-full bg-[var(--color-brand)] mx-auto"
                />
                <p className="mt-4 text-base text-black/70">
                  Vásárlás, lapszabászat, márkák, fizetés. A leggyakoribb
                  kérdések.
                </p>
              </div>
            </RevealOnScroll>

            <RevealOnScroll delay={0.1} className="mt-8">
              <FaqAccordion items={faqItems} />
            </RevealOnScroll>
          </div>
        </section>

        {/* CLOSING CTA */}
        <section className="bg-stone-wash py-12 md:py-16 border-t border-black/10">
          <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
            <RevealOnScroll>
              <div className="overflow-hidden rounded-3xl border border-black/10 bg-white shadow-[0_12px_40px_rgba(0,0,0,0.04)]">
                <div className="grid md:grid-cols-12">
                  <div className="p-8 text-left md:col-span-7 md:p-10">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-black/50">
                      Kecskemét · üzlet és bemutatóterem
                    </p>
                    <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900 md:text-3xl">
                      Személyesen is várjuk
                    </h2>
                    <a
                      href={directionsHref}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-4 inline-flex max-w-full items-start gap-2 rounded-lg text-base font-semibold text-slate-900 underline-offset-4 hover:text-[var(--color-brand)] hover:underline"
                    >
                      <CtaPinGlyph className="mt-0.5 shrink-0 text-[var(--color-brand)]" />
                      <span>{COMPANY.address.full}</span>
                    </a>

                    <div className="mt-6">
                      <p className="text-xs font-semibold uppercase tracking-wide text-black/55">
                        Nyitvatartás
                      </p>
                      <dl className="mt-2 max-w-sm space-y-2 text-sm">
                        <div className="flex items-baseline justify-between gap-4 border-b border-black/5 pb-2">
                          <dt className="text-black/65">Hétfő–péntek</dt>
                          <dd className="font-semibold tabular-nums text-slate-900">
                            {COMPANY.hours.weekdays.opens}–
                            {COMPANY.hours.weekdays.closes}
                          </dd>
                        </div>
                        <div className="flex items-baseline justify-between gap-4 border-b border-black/5 pb-2">
                          <dt className="text-black/65">Szombat</dt>
                          <dd className="font-semibold tabular-nums text-slate-900">
                            {COMPANY.hours.saturday.opens}–
                            {COMPANY.hours.saturday.closes}
                          </dd>
                        </div>
                        <div className="flex items-baseline justify-between gap-4">
                          <dt className="text-black/65">Vasárnap</dt>
                          <dd className="font-semibold text-slate-900">Zárva</dd>
                        </div>
                      </dl>
                    </div>

                    <ul className="mt-6 space-y-2.5 text-sm leading-relaxed text-black/70">
                      <li className="flex gap-2.5">
                        <span
                          aria-hidden
                          className="mt-2 h-1 w-1 shrink-0 rounded-full bg-[var(--color-brand)]"
                        />
                        Csak kérdése van? Ugyanúgy számítunk rá az üzletben.
                      </li>
                    </ul>
                  </div>

                  <div className="border-t border-black/10 bg-gradient-to-b from-stone-50/90 to-white p-8 md:col-span-5 md:border-l md:border-t-0 md:p-10">
                    <p className="text-xs font-semibold uppercase tracking-wide text-black/50">
                      Hogyan érhet el minket
                    </p>
                    <div className="mt-5 flex flex-col gap-3">
                      <a
                        href={directionsHref}
                        target="_blank"
                        rel="noreferrer"
                        className={`${ctaPrimary} w-full justify-center`}
                      >
                        Útvonal a térképen
                      </a>
                      <a
                        href={`tel:${COMPANY.phones.primary}`}
                        className={`${ctaSecondary} w-full flex-col gap-0.5 py-3.5`}
                      >
                        <span>Hívás</span>
                        <span className="text-sm font-semibold tabular-nums text-black/90">
                          {formatPhoneDisplay(COMPANY.phones.primary)}
                        </span>
                      </a>
                      <a
                        href={VASALATMESTER_URL}
                        target="_blank"
                        rel="noreferrer"
                        aria-label="Webáruház megnyitása: vasalatmester.hu"
                        className="group flex w-full items-center gap-3 rounded-2xl border border-black/10 bg-white px-4 py-3.5 text-left shadow-sm transition hover:border-[var(--color-brand)]/40 hover:shadow-md"
                      >
                        <span className="relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white ring-1 ring-black/[0.06]">
                          <Image
                            src="/img/vasalatmester-logo.png"
                            alt="Vasalatmester webáruház logója"
                            width={44}
                            height={44}
                            className="object-contain p-1"
                            unoptimized
                          />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-semibold text-slate-900">
                            Webáruház
                          </span>
                          <span className="mt-0.5 block text-xs text-black/55">
                            vasalatmester.hu · vasalat és kiegészítők
                          </span>
                        </span>
                        <span
                          aria-hidden
                          className="shrink-0 text-sm text-black/30 transition group-hover:text-[var(--color-brand)]"
                        >
                          ↗
                        </span>
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            </RevealOnScroll>
          </div>
        </section>
      </RevealOnLoad>
    </div>
  )
}
