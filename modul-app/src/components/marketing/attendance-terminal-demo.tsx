'use client'

import Image from 'next/image'
import { useEffect, useState } from 'react'

import { cn } from '@/lib/utils'

/**
 * A chipkártyás jelenlét-terminál képernyői animálva.
 *
 * A színek, feliratok és a sorrend a Pi-n futó Kivy appból jönnek
 * (`raspberry-pi-attendance/gui/welcome_screen.py`, `gui/result_screen.py`):
 * érkezés zöld, távozás piros, közte kékesszürke „Feldolgozás…”.
 * A betűméretek a valódi 480×640-es kijelzőről vannak leskálázva.
 *
 * A fázisokat JS lépteti, nem CSS keyframe: ahol a rendszer szintjén tiltva
 * van a mozgás, ott a CSS átmenetek nem futnak le, a lépések viszont látszanak.
 */

const SCREEN_ARRIVAL = '#33CC33'
const SCREEN_DEPARTURE = '#CC3333'
const SCREEN_PROCESSING = '#4D80B3'
const STATUS_ONLINE = '#38C761'

type Phase = 'idle' | 'cardIn' | 'cardTouch' | 'processing' | 'result'

/** A valódi eszközön a sikerképernyő 5 másodperc; itt rövidebb a hurok miatt. */
const PHASE_MS: Record<Phase, number> = {
  idle: 1200,
  cardIn: 600,
  cardTouch: 900,
  processing: 600,
  result: 3500
}

const FULL_CHAIN: Phase[] = [
  'idle',
  'cardIn',
  'cardTouch',
  'processing',
  'result'
]

/** Csökkentett mozgás: a kártya nem mozog, csak a képernyők váltanak. */
const REDUCED_CHAIN: Phase[] = ['idle', 'cardTouch', 'processing', 'result']

const SCANS = [
  { type: 'ÉRKEZÉS', name: 'Kovács Anna', bg: SCREEN_ARRIVAL },
  { type: 'TÁVOZÁS', name: 'Nagy Péter', bg: SCREEN_DEPARTURE }
] as const

function currentHhMm(): string {
  const d = new Date()
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export function AttendanceTerminalDemo({ className }: { className?: string }) {
  const [clock, setClock] = useState<string | null>(null)
  const [step, setStep] = useState(0)
  const [scanIndex, setScanIndex] = useState(0)
  const [reducedMotion, setReducedMotion] = useState(false)

  // Csak a kliensen rajzoljuk ki az időt, különben hidratálási eltérés lenne.
  useEffect(() => {
    setClock(currentHhMm())
    const id = window.setInterval(() => setClock(currentHhMm()), 10_000)
    return () => window.clearInterval(id)
  }, [])

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const apply = () => {
      setReducedMotion(mq.matches)
      setStep(0)
    }
    apply()
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [])

  const chain = reducedMotion ? REDUCED_CHAIN : FULL_CHAIN
  const phase = chain[step % chain.length] ?? 'idle'

  // Háttérfülön a böngésző magától lelassítja az időzítőt, nem kell külön szünet.
  useEffect(() => {
    const id = window.setTimeout(() => {
      const nextStep = step + 1
      if (nextStep % chain.length === 0) {
        setScanIndex((i) => (i + 1) % SCANS.length)
      }
      setStep(nextStep)
    }, PHASE_MS[phase])
    return () => window.clearTimeout(id)
  }, [phase, step, chain])

  const scan = SCANS[scanIndex]!
  const showCard = phase === 'cardIn' || phase === 'cardTouch'

  return (
    <div className={cn('flex flex-col items-center', className)}>
      <div
        role="img"
        aria-label={`Jelenlét-terminál: a dolgozó a chipkártyát a készülékhez érinti, a képernyő pedig kiírja, hogy ${scan.type.toLowerCase()}, a nevet és az időpontot.`}
        className="rounded-[28px] border border-zinc-800 bg-zinc-900 p-3 shadow-lg"
      >
        <div className="relative h-[356px] w-[268px] overflow-hidden rounded-[18px] bg-black sm:h-[400px] sm:w-[300px]">
          {/* A nyitóképernyő mindig a DOM-ban van, hogy a logók ne töltsenek
              újra minden körben; a többi képernyő fölé kerül. */}
          <div className="absolute inset-0 flex flex-col bg-black">
            <div className="flex items-start justify-between px-2.5 pt-2.5">
              <span className="rounded bg-white/25 px-3 py-2 text-[11px] font-bold text-white">
                Napló
              </span>
              <span className="flex items-center gap-2.5">
                <span
                  className="size-2.5 rounded-full"
                  style={{ backgroundColor: STATUS_ONLINE }}
                  aria-hidden
                />
                <span className="rounded bg-white/25 px-3 py-2 text-[11px] font-bold text-white">
                  Info
                </span>
              </span>
            </div>

            <div className="flex flex-1 items-center justify-center">
              <span className="text-[64px] font-bold leading-none tabular-nums tracking-tight text-white sm:text-[74px]">
                {clock ?? '\u00A0'}
              </span>
            </div>

            <div className="flex items-center gap-3 px-3 pb-4">
              <Image
                src="/images/hiros-logo.png"
                alt=""
                width={1425}
                height={297}
                sizes="150px"
                className="h-5 w-1/2 object-contain"
                aria-hidden
              />
              <Image
                src="/images/optinova-logo-on-dark.png"
                alt=""
                width={1024}
                height={259}
                sizes="150px"
                className="h-5 w-1/2 object-contain"
                aria-hidden
              />
            </div>
          </div>

          {phase === 'processing' ? (
            <div
              className="absolute inset-0 flex items-center justify-center"
              style={{ backgroundColor: SCREEN_PROCESSING }}
            >
              <span className="text-[26px] font-bold text-white">
                Feldolgozás…
              </span>
            </div>
          ) : null}

          {phase === 'result' ? (
            <div
              className="absolute inset-0 flex flex-col items-center justify-center gap-1 px-4 text-center"
              style={{ backgroundColor: scan.bg }}
            >
              <span className="text-[34px] font-bold leading-tight tracking-tight text-white">
                {scan.type}
              </span>
              <span className="text-[26px] font-bold leading-tight text-white">
                {scan.name}
              </span>
              <span className="text-[26px] font-bold leading-tight tabular-nums text-white">
                {clock ?? ''}
              </span>
            </div>
          ) : null}

          {/* A kártya két lépésben ér a képernyő aljához, ahol az olvasó van. */}
          {showCard ? (
            <div
              className="pointer-events-none absolute left-1/2 -translate-x-1/2 transition-all duration-300 ease-out"
              style={{ bottom: phase === 'cardTouch' ? 104 : 56 }}
            >
              <div className="relative">
                {phase === 'cardTouch' ? (
                  <span
                    className="absolute -inset-3 rounded-full border-2 border-white/50"
                    aria-hidden
                  />
                ) : null}
                <span className="relative flex h-[42px] w-[66px] items-center rounded-md bg-zinc-200 px-2 shadow-lg ring-1 ring-black/20">
                  <span className="h-4 w-5 rounded-sm bg-amber-400" aria-hidden />
                </span>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <p className="mt-4 text-[12px] text-ink-muted">
        A terminál valódi képernyője: 480 × 640 pixel, 5 másodperces
        visszajelzés.
      </p>
    </div>
  )
}
