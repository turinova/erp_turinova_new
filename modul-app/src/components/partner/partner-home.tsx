import Link from 'next/link'
import {
  ChevronRight,
  Globe,
  Home,
  Mail,
  MapPin,
  Phone
} from 'lucide-react'

import { PageHeader } from '@/components/patterns/page-header'
import { buttonVariants } from '@/components/ui/button'
import type { PartnerHomeContact } from '@/lib/partner/home-queries'
import { cn } from '@/lib/utils'

type HrefBag = {
  settings: string
  search: string
  opti: string
  quotes: string
  orders: string
}

type Props = {
  name: string
  companyLabel: string | null
  contact: PartnerHomeContact | null
  draftCount: number
  submittedCount: number
  hrefs: HrefBag
}

function faqItems(hrefs: HrefBag): Array<{ q: string; a: React.ReactNode }> {
  const linkClass = 'underline underline-offset-2'
  return [
    {
      q: 'Hogyan tudom módosítani a személyes vagy számlázási adataimat?',
      a: (
        <>
          A személyes és számlázási adatokat a{' '}
          <Link href={hrefs.settings} className={linkClass}>
            Beállítások
          </Link>{' '}
          menüpont alatt módosíthatod.
        </>
      )
    },
    {
      q: 'Hogyan fűzhetek megjegyzést a rendeléshez?',
      a: (
        <>
          Az{' '}
          <Link href={hrefs.quotes} className={linkClass}>
            Ajánlataim
          </Link>{' '}
          oldalon, a draft megnyitása után tudsz megjegyzést hozzáfűzni.
          Beküldéskor ez a megjegyzés eljut a lapszabászat csapatához.
        </>
      )
    },
    {
      q: 'Milyen formátumban tudom letölteni az ajánlatot?',
      a: (
        <>
          Az{' '}
          <Link href={hrefs.quotes} className={linkClass}>
            Ajánlataim
          </Link>{' '}
          oldalon a nyomtatás / PDF funkcióval mentheted vagy nyomtathatod az
          ajánlatot és a szabási tervet.
        </>
      )
    },
    {
      q: 'Mi történik, ha módosítani szeretném a leadott megrendelést?',
      a: 'A portálon beküldött rendelések utólag nem módosíthatók. Ha változtatni szeretnél, vedd fel a kapcsolatot a lapszabászat ügyfélszolgálatával, és add meg a rendelési számot.'
    },
    {
      q: 'A szabás méter hogyan van kiszámolva?',
      a: (
        <>
          <p>
            Az optimalizálás után csak azok a vágások számítanak, ahol a
            fűrészlap ténylegesen átvágta a lapterméket — az illeszkedő élek nem
            duplázódnak.
          </p>
          <p className="mt-2">
            <strong className="font-medium text-ink">Fontos:</strong> minden
            lapszabás szélezéssel kezdődik (egy teljes hosszanti és egy teljes
            keresztirányú vágás).
          </p>
        </>
      )
    },
    {
      q: 'Miért van hulladékszorzó, és miért 65% a kihozatal küszöb?',
      a: 'A szabás során hulladék keletkezik (fűrészvastagság, kötelező szélezés, nem hasznosítható maradékok). Tapasztalat szerint 65%-os kihozatal felett gyakran előnyösebb a teljes tábla megvásárlása.'
    },
    {
      q: 'A szabási maradék kinek a tulajdona?',
      a: 'Ha rendelős bútorlapot választasz, a hulladék a tied. Raktári bútorlap és négyzetméteres árképzés esetén a tábla maradéka a vállalkozásé marad.'
    },
    {
      q: 'Hol látom a rendelésem státuszát?',
      a: (
        <>
          A{' '}
          <Link href={hrefs.orders} className={linkClass}>
            Beküldött rendeléseim
          </Link>{' '}
          oldalon követheted a státuszt. A beküldött ajánlat tartalmát utólag nem
          módosíthatod, de bármikor megnyithatod.
        </>
      )
    }
  ]
}

export function PartnerHome({
  name,
  companyLabel,
  contact,
  draftCount,
  submittedCount,
  hrefs
}: Props) {
  const faqs = faqItems(hrefs)

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <PageHeader
        title={`Szia, ${name}!`}
        description="Anyagkeresés és rendelés a kapcsolt lapszabászatnál."
        icon={Home}
        accent="slate"
        actions={
          <Link
            href={hrefs.opti}
            className={cn(
              buttonVariants({ variant: 'primary' }),
              'no-underline'
            )}
          >
            Opti rendelés indítása
          </Link>
        }
      />

      <div
        className={cn(
          'grid gap-3',
          contact ? 'md:grid-cols-2' : 'md:grid-cols-1'
        )}
      >
        <section className="rounded-md border border-border bg-surface p-4">
          <h2 className="text-body font-semibold text-ink">Kapcsolt cég</h2>
          <p className="mt-1 text-body text-ink">
            {companyLabel ?? 'Még nincs kiválasztott cég.'}
          </p>
          <Link
            href={hrefs.settings}
            className="mt-2 inline-block text-hint text-ink-secondary no-underline hover:underline"
          >
            Cég vagy profil módosítása →
          </Link>
        </section>

        {contact ? (
          <section className="rounded-md border border-border bg-surface p-4">
            <h2 className="text-body font-semibold text-ink">Kapcsolat</h2>
            <ul className="mt-2 space-y-2 text-body text-ink-secondary">
              {contact.addressLine ? (
                <li className="flex gap-2">
                  <MapPin
                    className="mt-0.5 size-3.5 shrink-0 text-ink-muted"
                    aria-hidden
                  />
                  <span>{contact.addressLine}</span>
                </li>
              ) : null}
              {contact.phone ? (
                <li className="flex gap-2">
                  <Phone
                    className="mt-0.5 size-3.5 shrink-0 text-ink-muted"
                    aria-hidden
                  />
                  <a
                    href={`tel:${contact.phone.replace(/\s/g, '')}`}
                    className="text-ink no-underline hover:underline"
                  >
                    {contact.phone}
                  </a>
                </li>
              ) : null}
              {contact.email ? (
                <li className="flex gap-2">
                  <Mail
                    className="mt-0.5 size-3.5 shrink-0 text-ink-muted"
                    aria-hidden
                  />
                  <a
                    href={`mailto:${contact.email}`}
                    className="text-ink no-underline hover:underline"
                  >
                    {contact.email}
                  </a>
                </li>
              ) : null}
              {contact.website ? (
                <li className="flex gap-2">
                  <Globe
                    className="mt-0.5 size-3.5 shrink-0 text-ink-muted"
                    aria-hidden
                  />
                  <a
                    href={
                      contact.website.startsWith('http')
                        ? contact.website
                        : `https://${contact.website}`
                    }
                    target="_blank"
                    rel="noopener noreferrer"
                    className="truncate text-ink no-underline hover:underline"
                  >
                    {contact.website}
                  </a>
                </li>
              ) : null}
            </ul>
          </section>
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Link
          href={hrefs.quotes}
          className="rounded-md border border-border bg-surface p-3 no-underline transition-colors duration-fast hover:bg-subtle"
        >
          <p className="text-[20px] font-semibold leading-none text-ink">
            {draftCount}
          </p>
          <p className="mt-1.5 text-hint text-ink-secondary">Draft ajánlatok</p>
          {draftCount === 0 ? (
            <p className="mt-0.5 text-hint text-ink-muted">
              Még nincs mentett draft
            </p>
          ) : null}
        </Link>
        <Link
          href={hrefs.orders}
          className="rounded-md border border-border bg-surface p-3 no-underline transition-colors duration-fast hover:bg-subtle"
        >
          <p className="text-[20px] font-semibold leading-none text-ink">
            {submittedCount}
          </p>
          <p className="mt-1.5 text-hint text-ink-secondary">
            Beküldött rendelések
          </p>
          {submittedCount === 0 ? (
            <p className="mt-0.5 text-hint text-ink-muted">Még nincs beküldés</p>
          ) : null}
        </Link>
      </div>

      <section className="rounded-md border border-border bg-surface p-4">
        <h2 className="text-body font-semibold text-ink">
          Megrendelés folyamata
        </h2>
        <div className="mt-3 flex flex-col gap-3 md:flex-row md:items-stretch md:gap-2">
          <StepCard
            n={1}
            title="Opti — draft mentés"
            href={hrefs.opti}
            linkLabel="Opti megnyitása"
          >
            Add meg a paneleket, futtasd az optimalizálást, majd mentsd
            draftként. A mentés még nem rendelés.
          </StepCard>
          <StepArrow />
          <StepCard
            n={2}
            title="Ajánlataim — beküldés"
            href={hrefs.quotes}
            linkLabel="Ajánlataim"
          >
            A draftok itt szerkeszthetők. Ha kész vagy, küldd be a cégnek —
            ekkor válik hivatalos rendeléssé.
          </StepCard>
          <StepArrow />
          <StepCard
            n={3}
            title="Megrendelések — követés"
            href={hrefs.orders}
            linkLabel="Rendeléseim"
          >
            A beküldött tételeket itt követheted. Tartalmuk utólag nem
            módosítható.
          </StepCard>
        </div>
        <p className="mt-3 text-hint text-ink-muted">
          Tippek:{' '}
          <Link
            href={hrefs.search}
            className="text-ink-secondary no-underline hover:underline"
          >
            Anyagkereső
          </Link>
          {' · '}
          <Link
            href={hrefs.settings}
            className="text-ink-secondary no-underline hover:underline"
          >
            Beállítások
          </Link>
        </p>
      </section>

      <aside
        role="note"
        className="rounded-md border border-warning/40 bg-warning-soft px-3 py-2.5 text-body text-warning-ink"
      >
        <p className="font-semibold">A táblakiosztás csak tájékoztató</p>
        <p className="mt-1">
          Az optimalizálásban látható elrendezés nem a tényleges gyártási
          kiosztás. Minden lapszabászat más gépet és szoftvert használ — a
          végleges panelkiosztás eltérhet. Rendelésnél a kiválasztott cég saját
          optimalizálása az érvényes.
        </p>
      </aside>

      <section className="rounded-md border border-border bg-surface p-4">
        <h2 className="text-body font-semibold text-ink">
          Gyakran ismételt kérdések
        </h2>
        <div className="mt-2 divide-y divide-border">
          {faqs.map((item, i) => (
            <details key={item.q} className="group py-2" open={i === 0}>
              <summary className="cursor-pointer list-none text-body font-medium text-ink marker:content-none [&::-webkit-details-marker]:hidden">
                <span className="flex items-start justify-between gap-2">
                  {item.q}
                  <ChevronRight className="mt-0.5 size-3.5 shrink-0 text-ink-muted transition-transform duration-fast group-open:rotate-90" />
                </span>
              </summary>
              <div className="mt-1.5 pr-6 text-body text-ink-secondary">
                {item.a}
              </div>
            </details>
          ))}
        </div>
      </section>
    </div>
  )
}

function StepArrow() {
  return (
    <div
      className="hidden shrink-0 items-center justify-center md:flex"
      aria-hidden
    >
      <ChevronRight className="size-4 text-ink-muted" />
    </div>
  )
}

function StepCard({
  n,
  title,
  children,
  href,
  linkLabel
}: {
  n: number
  title: string
  children: React.ReactNode
  href: string
  linkLabel: string
}) {
  return (
    <div className="flex min-w-0 flex-1 flex-col rounded-md border border-border bg-subtle/60 p-3">
      <p className="text-hint font-semibold text-ink-muted">{n}. lépés</p>
      <p className="mt-0.5 text-body font-semibold text-ink">{title}</p>
      <p className="mt-1.5 flex-1 text-hint text-ink-secondary">{children}</p>
      <Link
        href={href}
        className="mt-2 inline-flex items-center gap-1 text-hint font-medium text-ink no-underline hover:underline"
      >
        {linkLabel}
        <ChevronRight className="size-3" aria-hidden />
      </Link>
    </div>
  )
}
