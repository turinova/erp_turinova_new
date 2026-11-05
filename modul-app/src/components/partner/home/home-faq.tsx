import Link from 'next/link'
import { ChevronRight } from 'lucide-react'

import { ARCHIVE_LABEL, ARCHIVE_URL } from '@/lib/partner/archive-notice'

type Hrefs = { settings: string; quotes: string; orders: string }

function faqItems(
  hrefs: Hrefs,
  archiveVisible: boolean
): Array<{ q: string; a: React.ReactNode }> {
  const linkClass = 'text-ink underline underline-offset-2'
  return [
    {
      q: 'Hol vannak a régi rendeléseim?',
      a: archiveVisible ? (
        <>
          A régi rendszerben leadott ajánlataidat és rendeléseidet az{' '}
          <a
            href={ARCHIVE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className={linkClass}
          >
            {ARCHIVE_LABEL}
          </a>{' '}
          oldalon találod. 3 hónapig érhető el, csak megnézni lehet. Belépés
          ugyanúgy, mint eddig: a régi e-mail címeddel és jelszavaddal.
        </>
      ) : (
        'A régi rendszer archívuma már nem érhető el. Ha egy régi rendelésről kérdésed van, hívd a céget.'
      )
    },
    {
      q: 'Mi a különbség az ajánlat és a rendelés között?',
      a: (
        <>
          Az Optiban mentett tétel még csak ajánlat — a cég nem látja. Az{' '}
          <Link href={hrefs.quotes} className={linkClass}>
            Ajánlataim
          </Link>{' '}
          oldalon a „Beküldés” gombbal küldöd el, ettől lesz rendelés.
        </>
      )
    },
    {
      q: 'A táblakiosztás a végleges szabási terv?',
      a: 'Nem. Az Optiban látható elrendezés csak tájékoztató. Minden lapszabászat más gépet és programot használ, a végleges kiosztás eltérhet. Rendelésnél a cég saját optimalizálása az érvényes.'
    },
    {
      q: 'Hol látom, hol tart a rendelésem?',
      a: (
        <>
          A{' '}
          <Link href={hrefs.orders} className={linkClass}>
            Rendeléseim
          </Link>{' '}
          oldalon: állapot, gyártás napja, és hogy mennyit kell még fizetni.
        </>
      )
    },
    {
      q: 'Módosíthatom a beküldött rendelést?',
      a: 'A beküldött rendelés már nem módosítható. Ha változtatni szeretnél, hívd a céget, és mondd meg a rendelés számát.'
    },
    {
      q: 'Hogyan fűzhetek megjegyzést a rendeléshez?',
      a: (
        <>
          Az{' '}
          <Link href={hrefs.quotes} className={linkClass}>
            Ajánlataim
          </Link>{' '}
          oldalon nyisd meg az ajánlatot, ott írhatsz megjegyzést. Beküldéskor
          ez eljut a céghez.
        </>
      )
    },
    {
      q: 'Hogyan tölthetem le az ajánlatot?',
      a: 'Nyisd meg az ajánlatot vagy rendelést, és használd a nyomtatás / PDF gombot.'
    },
    {
      q: 'Hogyan számolják a szabás métert?',
      a: 'Csak azok a vágások számítanak, ahol a fűrész ténylegesen átvágja a lapot. Minden szabás szélezéssel kezdődik (egy hosszanti és egy keresztirányú vágás).'
    },
    {
      q: 'Miért van hulladékszorzó?',
      a: 'Szabáskor hulladék keletkezik (fűrészlap vastagsága, szélezés, kis maradékok). 65% feletti kihozatalnál gyakran jobban megéri a teljes táblát megvenni.'
    },
    {
      q: 'Kié a szabási maradék?',
      a: 'Rendelős bútorlapnál a maradék a tiéd. Raktári bútorlapnál és négyzetméteres árnál a tábla maradéka a cégé.'
    },
    {
      q: 'Hol módosíthatom az adataimat?',
      a: (
        <>
          A{' '}
          <Link href={hrefs.settings} className={linkClass}>
            Beállítások
          </Link>{' '}
          menüben: személyes és számlázási adatok, kapcsolt cég.
        </>
      )
    }
  ]
}

export function HomeFaq({
  hrefs,
  archiveVisible
}: {
  hrefs: Hrefs
  archiveVisible: boolean
}) {
  const items = faqItems(hrefs, archiveVisible)
  return (
    <details className="group/faq rounded-lg border border-border bg-surface">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-5 py-3.5 text-[17px] font-semibold text-ink [&::-webkit-details-marker]:hidden">
        Gyakori kérdések
        <ChevronRight
          className="size-5 text-ink-muted transition-transform group-open/faq:rotate-90"
          aria-hidden
        />
      </summary>
      <div className="divide-y divide-border border-t border-border px-5">
        {items.map((item) => (
          <details key={item.q} className="group/q py-3">
            <summary className="flex cursor-pointer list-none items-start justify-between gap-3 text-[15px] font-medium text-ink [&::-webkit-details-marker]:hidden">
              {item.q}
              <ChevronRight
                className="mt-0.5 size-4 shrink-0 text-ink-muted transition-transform group-open/q:rotate-90"
                aria-hidden
              />
            </summary>
            <div className="mt-1.5 pr-6 text-[15px] text-ink-secondary">
              {item.a}
            </div>
          </details>
        ))}
      </div>
    </details>
  )
}
