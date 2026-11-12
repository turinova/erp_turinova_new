'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback } from 'react'
import {
  AlertTriangle,
  ArrowLeft,
  Building2,
  CheckCircle2,
  CreditCard,
  Info,
  Landmark,
  ShieldAlert,
  Sparkles
} from 'lucide-react'

import { Button, buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export type PartnerPaymentGuideMode = 'utalas' | 'kartya'

type Tone = 'info' | 'warning' | 'danger' | 'success'

type Step = {
  title: string
  body: string
  who: string
  detail?: string
}

type EdgeCase = {
  tone: Tone
  title: string
  body: string
  action?: string
}

const TONE_CARD: Record<Tone, string> = {
  info: 'border-info/35 bg-info-soft',
  warning: 'border-warning/40 bg-warning-soft',
  danger: 'border-danger/35 bg-danger-soft',
  success: 'border-success/35 bg-success-soft'
}

const TONE_INK: Record<Tone, string> = {
  info: 'text-info-ink',
  warning: 'text-warning-ink',
  danger: 'text-danger-ink',
  success: 'text-success-ink'
}

const TONE_ICON: Record<Tone, typeof Info> = {
  info: Info,
  warning: AlertTriangle,
  danger: ShieldAlert,
  success: Sparkles
}

const TONE_LABEL: Record<Tone, string> = {
  info: 'Tudnivaló',
  warning: 'Figyelem',
  danger: 'Azonnal nézd',
  success: 'Rendben van'
}

const TRANSFER_STEPS: Step[] = [
  {
    title: 'A partner beküldi a rendelést',
    body: 'A partnerportálon elmenti az ajánlatot, és átutalást választ fizetésnek.',
    who: 'Partner'
  },
  {
    title: 'Kap egy fizetési felszólítót',
    body: 'Ez a díjbekérő: még nem számla, csak azt mondja meg, mennyit és hova utaljon. ÁFA ilyenkor még nem indul.',
    who: 'Turinova → Számlázz → e-mail',
    detail:
      'Csak akkor megy automatikusan, ha a cégnél be van kapcsolva a partner auto díjbekérő, van Agent kulcs, és a partner számlázási adatai megvannak.'
  },
  {
    title: 'A partner utal',
    body: 'A közleménybe pontosan bemásolja a felszólítón szereplő számot (díjbekérő- vagy rendelésszám).',
    who: 'Partner + bank',
    detail:
      'Ha a bank össze van kötve a Számlázz.hu-val (Autokassza), a rendszer felismerheti az utalást. Ez akár egy napot is várhat.'
  },
  {
    title: 'Megérkezett a pénz',
    body: 'Ezt háromféleképpen tudhatjátok meg: ti rögzítitek a Pénzügyben, az Autokassza jelzi, vagy később a rendszer ellenőrzi.',
    who: 'Staff / Számlázz / Turinova',
    detail:
      'A számlán a „teljesítés” napja ez a banki nap lesz — nem az, amikor ti kattintotok.'
  },
  {
    title: 'Előlegszámla készül',
    body: 'Most már van pénz, de a munka / áru még nincs átadva. Erről megy a hivatalos előlegszámla (ÁFA innen számít).',
    who: 'Turinova → Számlázz',
    detail:
      'Fontos: a Számlázz „díjbekérőből automata számla” kapcsolót hagyd KI. Az előleget a Turinova állítja — így nem lesz kétféle, összezavaró számla.'
  },
  {
    title: 'Gyártás és átadás',
    body: 'Ti elkészítitek és átadjátok a munkát / árut a megszokott folyamat szerint.',
    who: 'Cég (ti)'
  },
  {
    title: 'Záró számla',
    body: 'Átáadáskor jön a végszámla. Az előleget levonja — ha mindent előre fizettek, a záró akár 0 Ft is lehet.',
    who: 'Turinova → Számlázz'
  }
]

const CARD_STEPS: Step[] = [
  {
    title: 'A partner beküldi a rendelést',
    body: 'Bankkártyát választ. Ehhez a cégnél be kell legyen kapcsolva a Teya online kártyás fizetés.',
    who: 'Partner'
  },
  {
    title: 'Nincs felszólító',
    body: 'Kártyánál nem küldünk díjbekérőt — a pénz azonnal megérkezhet, ezért felesleges és hibás lenne.',
    who: 'Turinova szabály'
  },
  {
    title: 'Kártyázás a partneroldalon',
    body: 'A partner a biztonságos Teya ablakban adja meg a kártyát. A Turinova nem látja és nem tárolja a kártyaszámot.',
    who: 'Partner + Teya'
  },
  {
    title: 'A bank visszaigazol',
    body: 'A böngésző „siker” üzenete még nem a vége. A Teya hivatalos visszaigazolása után állítjuk be a rendelést kifizetettre.',
    who: 'Teya → Turinova',
    detail:
      'Ez a webhook-lépés. Amíg nincs kész, a partner láthat „elküldve” üzenetet, de a Pénzügyben még unpaid maradhat.'
  },
  {
    title: 'Előlegszámla azonnal',
    body: 'Kártyánál a törvény szerint gyorsan kell számlázni. Az előlegszámla teljesítési napja a fizetés napja.',
    who: 'Turinova → Számlázz'
  },
  {
    title: 'Gyártás és átadás',
    body: 'Ugyanúgy gyártotok és átadtok, mint utalásnál.',
    who: 'Cég (ti)'
  },
  {
    title: 'Záró számla',
    body: 'Átáadáskor végszámla, előleg levonásával.',
    who: 'Turinova → Számlázz'
  }
]

const TRANSFER_EDGES: EdgeCase[] = [
  {
    tone: 'info',
    title: 'Nem ment ki felszólító',
    body: 'Ha az auto díjbekérő KI van, hiányzik az Agent kulcs, vagy a partner számlázási adatai hiányosak, a rendelés bejön — de nem megy automatikus felszólító.',
    action: 'Pénzügy / ajánlat: állítsatok ki kézzel díjbekérőt, vagy javítsátok a beállítást.'
  },
  {
    tone: 'warning',
    title: 'A felszólító kiküldése hibázott',
    body: 'A rendszer újra próbálkozik. Addig a partner nem kap e-mailt.',
    action: 'Nézzétek a Bizonylatok / Agent hibákat; ha kell, küldjétek újra.'
  },
  {
    tone: 'warning',
    title: 'Rossz közlemény az utaláson',
    body: 'Ha a partner nem a felszólító- vagy rendelésszámot írja be, az Autokassza nem párosítja automatikusan.',
    action: 'A Pénzügyben kézzel rögzítsétek a befizetést a rendeléshez.'
  },
  {
    tone: 'info',
    title: 'Autokassza késhet akár egy napot',
    body: 'A bank és a Számlázz összekötése nem azonnali. Ez nem hiba.',
    action: 'Ha sürgős: rögzítsétek kézzel a Pénzügyben.'
  },
  {
    tone: 'info',
    title: 'Nincs Autokassza? Semmi gond',
    body: 'Akkor csak kézi befizetés-rögzítés van. Utána ugyanúgy jön az előlegszámla.',
    action: 'Pénzügy → befizetés a rendeléshez.'
  },
  {
    tone: 'success',
    title: 'Dupla jelzés nem csinál két számlát',
    body: 'Ha ti is rögzítitek, és a bank is jelzi ugyanazt a pénzt, a rendszernek egy előlegszámlát szabad kiállítania.'
  },
  {
    tone: 'info',
    title: 'Este jött a pénz, holnap a számla kelte',
    body: 'A számla kelte lehet másnap — a „teljesítés” napja viszont a banki jóváírás napja marad. Az ÁFA napja így helyes.'
  },
  {
    tone: 'danger',
    title: 'Pénz megvan, de nincs előleg ~2 hétig',
    body: 'Utalásnál a beérkezett pénzről általában 15 napon belül kell számlázni. Ha a pénz megvan, de nincs előlegszámla, ÁFA kockázat.',
    action: 'Azonnal ellenőrizzétek a Pénzügyet / Bizonylatokat, és állítsatok ki előleget.'
  },
  {
    tone: 'success',
    title: '0 Ft záró számla is kell',
    body: 'Ha mindent előre utaltak, a záró számla összege lehet 0 Ft — de átadáskor ki kell állítani.'
  },
  {
    tone: 'warning',
    title: 'Visszatérítés / sztornó',
    body: 'Ha visszaadjátok a pénzt, a számlát is helyesbíteni / sztornózni kell. Ez most még nem teljesen automata út.',
    action: 'Egyeztessetek a könyvelővel, és a Számlázz / Bizonylatok felületen intézzétek.'
  }
]

const CARD_EDGES: EdgeCase[] = [
  {
    tone: 'warning',
    title: 'Teya nincs bekapcsolva / nincs ready',
    body: 'Ha nincs Éles/Teszt credential, vagy nincs Agent / számlázási adat, a partner nem tud kártyázni.',
    action: 'Beállítások → Partner → Teya online + számlázási adatok.'
  },
  {
    tone: 'info',
    title: 'Sikertelen vagy megszakított kártyázás',
    body: 'Nincs „kifizetve” státusz, nincs számla. A partner újra próbálhat.',
    action: 'Hagyjátok unpaid-on, amíg újra nem fizet.'
  },
  {
    tone: 'warning',
    title: 'Böngésző „siker” ≠ banki igazság',
    body: 'A partner láthat sikeres üzenetet, de a Pénzügyben még unpaid lehet, amíg a Teya hivatalos visszaigazolása (webhook) meg nem érkezik.',
    action: 'Ne állítsatok kézzel „fizetve”-t csak a partner üzenete alapján — várjátok / ellenőrizzétek a Teya státuszt.'
  },
  {
    tone: 'info',
    title: 'Este fizetés, holnap kelte',
    body: 'Ha a Számlázz este nem elérhető, a számla holnap kelhet. A teljesítés dátuma a fizetés napja marad.'
  },
  {
    tone: 'danger',
    title: '24 órán belül nincs előlegszámla',
    body: 'Kártyánál gyorsan kell számlázni. Ha a pénz megvan, de egy napja nincs előleg, ÁFA kockázat.',
    action: 'Azonnal nézzétek a Bizonylatokat / Agent hibákat, és állítsatok ki előleget.'
  },
  {
    tone: 'success',
    title: 'Dupla webhook nem csinál két előleget',
    body: 'Ha a Teya kétszer küldi ugyanazt a fizetést, egy fizetés = egy előlegszámla.'
  },
  {
    tone: 'warning',
    title: 'Éles és Teszt keverése',
    body: 'Ha a kulcs a business.teya.com-ról jött, de a Turinovában Teszt van (vagy fordítva), a kapcsolat elbukik.',
    action: 'Éles kulcs → Éles mód; Teszt kulcs → Teszt mód. Utána „Kapcsolat ellenőrzése”.'
  },
  {
    tone: 'success',
    title: '0 Ft záró számla is kell',
    body: '100% kártyás előleg után a záró lehet 0 Ft — átadáskor akkor is kiállítjuk.'
  },
  {
    tone: 'warning',
    title: 'Visszatérítés / sztornó',
    body: 'Teya refund után a számlát is sztornózni / helyesbíteni kell, és az ERP-ben visszavonni a fizetettséget. Ez külön, nem automata út.',
    action: 'Egyeztessetek a könyvelővel; ne hagyjátok „paid” állapotban a rendelést refund után.'
  }
]

const CHECKLIST = [
  'Számlázz Agent kulcs be van állítva',
  'Partner auto díjbekérő: ha utalást használtok, kapcsoljátok be',
  'Számlázz: „Díjbekérő automatikus számlázása” legyen KI',
  'Opcionális: Autokassza (bank ↔ Számlázz) az utalásokhoz',
  'Kártyához: Beállítások → Partner → Teya online kártya (Éles/Teszt egyezzen)',
  'Partner számlázási adatai (név, cím, e-mail) megvannak beküldés előtt'
]

type Props = {
  mode: PartnerPaymentGuideMode
}

function ToneCard({ item }: { item: EdgeCase }) {
  const Icon = TONE_ICON[item.tone]
  return (
    <li
      className={cn(
        'rounded-md border px-3 py-2.5',
        TONE_CARD[item.tone],
        TONE_INK[item.tone]
      )}
    >
      <div className="flex gap-2.5">
        <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
        <div className="min-w-0 flex-1 space-y-1">
          <p className="text-hint font-medium opacity-80">
            {TONE_LABEL[item.tone]}
          </p>
          <p className="text-body font-semibold">{item.title}</p>
          <p className="text-body opacity-95">{item.body}</p>
          {item.action ? (
            <p className="text-hint font-medium">
              Mit tegyetek: {item.action}
            </p>
          ) : null}
        </div>
      </div>
    </li>
  )
}

export function PartnerPaymentGuide({ mode }: Props) {
  const router = useRouter()
  const steps = mode === 'utalas' ? TRANSFER_STEPS : CARD_STEPS
  const edges = mode === 'utalas' ? TRANSFER_EDGES : CARD_EDGES

  const setMode = useCallback(
    (next: PartnerPaymentGuideMode) => {
      router.replace(`/penzugy/utmutato?mod=${next}`, { scroll: false })
    },
    [router]
  )

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link
          href="/penzugy"
          className={cn(
            buttonVariants({ variant: 'ghost', size: 'sm' }),
            'gap-1.5 text-ink-secondary'
          )}
        >
          <ArrowLeft className="size-3.5" aria-hidden />
          Vissza a Pénzügyhöz
        </Link>
      </div>

      <header className="space-y-2">
        <h1 className="text-h1 text-ink">Partner fizetés — hogyan működik?</h1>
        <p className="text-body text-ink-secondary">
          A partner vagy <strong className="font-medium text-ink">utal</strong>,
          vagy <strong className="font-medium text-ink">kártyáz</strong>.
          Utalásnál először felszólítót küldünk; ha megjött a pénz, számlázunk.
          Kártyánál azonnal jön a pénz, ezért azonnal számlázunk. A végén,
          amikor átadjátok a munkát, jön a záró számla.
        </p>
      </header>

      <div
        className="flex flex-wrap gap-2"
        role="tablist"
        aria-label="Fizetési mód"
      >
        <Button
          type="button"
          variant={mode === 'utalas' ? 'primary' : 'secondary'}
          size="sm"
          role="tab"
          aria-selected={mode === 'utalas'}
          onClick={() => setMode('utalas')}
          className="gap-1.5"
        >
          <Landmark className="size-3.5" aria-hidden />
          Átutalásos partner
        </Button>
        <Button
          type="button"
          variant={mode === 'kartya' ? 'primary' : 'secondary'}
          size="sm"
          role="tab"
          aria-selected={mode === 'kartya'}
          onClick={() => setMode('kartya')}
          className="gap-1.5"
        >
          <CreditCard className="size-3.5" aria-hidden />
          Kártyás partner
        </Button>
      </div>

      <ol className="space-y-2" aria-label="Lépések">
        {steps.map((step, index) => (
          <li
            key={`${mode}-${index}`}
            className="rounded-md border border-border bg-surface p-3"
          >
            <div className="flex gap-3">
              <span
                className={cn(
                  'flex size-7 shrink-0 items-center justify-center rounded-full text-[12px] font-semibold text-white',
                  mode === 'utalas' ? 'bg-info' : 'bg-success'
                )}
                aria-hidden
              >
                {index + 1}
              </span>
              <div className="min-w-0 flex-1 space-y-1">
                <p className="text-body font-semibold text-ink">{step.title}</p>
                <p className="text-body text-ink-secondary">{step.body}</p>
                <p className="text-hint text-ink-muted">
                  Ki csinálja: {step.who}
                </p>
                {step.detail ? (
                  <details className="pt-1">
                    <summary className="cursor-pointer text-hint font-medium text-ink underline-offset-2 hover:underline">
                      Részletek
                    </summary>
                    <p className="mt-1.5 text-hint text-ink-secondary">
                      {step.detail}
                    </p>
                  </details>
                ) : null}
              </div>
            </div>
          </li>
        ))}
      </ol>

      <section className="space-y-2" aria-labelledby="edge-heading">
        <div className="flex items-center gap-2">
          <AlertTriangle
            className="size-4 text-warning-ink"
            aria-hidden
          />
          <h2 id="edge-heading" className="text-h3 text-ink">
            Ha valami nem a szokásos
          </h2>
        </div>
        <p className="text-hint text-ink-secondary">
          {mode === 'utalas'
            ? 'Átutalásos esetek — mit jelent, és mit tegyetek.'
            : 'Kártyás esetek — mit jelent, és mit tegyetek.'}
        </p>
        <ul className="space-y-2">
          {edges.map((item) => (
            <ToneCard key={`${mode}-${item.title}`} item={item} />
          ))}
        </ul>
      </section>

      <div
        className="rounded-md border border-warning/40 bg-warning-soft px-3 py-3"
        role="note"
      >
        <div className="flex gap-2.5 text-warning-ink">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
          <div>
            <p className="text-body font-semibold">
              Egy fontos kapcsoló a Számlázz.hu-n
            </p>
            <p className="mt-1 text-body">
              A „Díjbekérő automatikus számlázása” legyen{' '}
              <strong className="font-semibold">kikapcsolva</strong>. Ha be van
              kapcsolva, a Számlázz magától másfajta számlát is csinálhat —
              nálunk az előlegszámlát a Turinova intézi, hogy az ÁFA és a záró
              számla rendben legyen.
            </p>
          </div>
        </div>
      </div>

      <section className="rounded-md border border-border bg-surface p-3">
        <div className="mb-2 flex items-center gap-2">
          <Building2 className="size-4 text-ink-secondary" aria-hidden />
          <h2 className="text-h3 text-ink">Beállítás-ellenőrző lista</h2>
        </div>
        <ul className="space-y-1.5">
          {CHECKLIST.map((item) => (
            <li
              key={item}
              className="flex items-start gap-2 text-body text-ink-secondary"
            >
              <CheckCircle2
                className="mt-0.5 size-3.5 shrink-0 text-success"
                aria-hidden
              />
              <span>{item}</span>
            </li>
          ))}
        </ul>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link
            href="/beallitasok/szamlazas"
            className={buttonVariants({ variant: 'secondary', size: 'sm' })}
          >
            Számlázás beállítások
          </Link>
          <Link
            href="/beallitasok/partner"
            className={buttonVariants({ variant: 'secondary', size: 'sm' })}
          >
            Partner / Teya
          </Link>
          <Link
            href="/penzugy"
            className={buttonVariants({ variant: 'secondary', size: 'sm' })}
          >
            Pénzügy áttekintés
          </Link>
        </div>
      </section>

      <p className="text-hint text-ink-muted">
        Ez egy magyarázó oldal a cégnek — nem adótanácsadás. A fejlesztői
        részletek a belső dokumentációban (57) vannak.
      </p>
    </div>
  )
}
