import Link from 'next/link'
import { ArrowRight, Scale } from 'lucide-react'

import {
  formatReconMoney,
  RECON_BONUS,
  yearMonthLabel
} from '@/lib/daily-reconciliation/parse'
import type { HomeNapiZarasSnapshot } from '@/lib/home/napi-zaras-snapshot'
import { cn } from '@/lib/utils'

type Mood = 'success' | 'warning' | 'danger' | 'neutral'

function resolveMood(data: HomeNapiZarasSnapshot): Mood {
  if (!data.todayIsWorkday) {
    if (data.summary.bonusTier >= 90) return 'success'
    if ((data.summary.accuracyPct ?? 0) < 90 && data.summary.filledCount > 0) {
      return 'warning'
    }
    return 'neutral'
  }
  if (data.todayStatus === 'ok') return 'success'
  if (data.todayStatus === 'variance') return 'danger'
  if (data.todayStatus === 'partial' || data.todayStatus === 'empty') {
    return 'warning'
  }
  return 'neutral'
}

const moodShell: Record<Mood, string> = {
  success: 'border-success/40 bg-success-soft',
  warning: 'border-warning/40 bg-warning-soft',
  danger: 'border-danger/40 bg-danger-soft',
  neutral: 'border-border bg-surface'
}

const moodInk: Record<Mood, string> = {
  success: 'text-success-ink',
  warning: 'text-warning-ink',
  danger: 'text-danger-ink',
  neutral: 'text-ink'
}

const moodMuted: Record<Mood, string> = {
  success: 'text-success-ink/80',
  warning: 'text-warning-ink/80',
  danger: 'text-danger-ink/80',
  neutral: 'text-ink-secondary'
}

const moodBar: Record<Mood, string> = {
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-danger',
  neutral: 'bg-ink'
}

function headline(data: HomeNapiZarasSnapshot): {
  title: string
  subtitle: string
  cta: string
} {
  const month = yearMonthLabel(data.yearMonth)
  const cta = 'Napi zárás'

  if (!data.todayIsWorkday) {
    return {
      title: 'Havi elszámolás',
      subtitle: `${month} · ma nincs bolti munkanap`,
      cta
    }
  }
  if (data.todayStatus === 'ok') {
    return {
      title: 'Mai zárás rendben',
      subtitle: `${month} · pontosság és járó bónusz lent`,
      cta
    }
  }
  if (data.todayStatus === 'variance') {
    return {
      title: 'Ma eltérés van',
      subtitle: 'A gép és a bolt összege nem stimmel — ellenőrizd a zárást.',
      cta
    }
  }
  if (data.todayStatus === 'partial') {
    return {
      title: 'Mai zárás hiányos',
      subtitle: 'Még nincs mindhárom tender (KP / kártya / utalás) mentve.',
      cta
    }
  }
  return {
    title: 'Mai zárás még nincs',
    subtitle:
      data.summary.missingPastCount > 1
        ? `${data.summary.missingPastCount} nap vár zárásra · ${month}`
        : `Nyisd meg a zárást, ha megvannak a nap végi számok · ${month}`,
    cta
  }
}

export function HomeNapiZarasCard({ data }: { data: HomeNapiZarasSnapshot }) {
  const mood = resolveMood(data)
  const copy = headline(data)
  const pct = Math.min(100, data.summary.accuracyPct ?? 0)
  const href = `/ertekesitesek/napi-egyeztetes?month=${data.yearMonth}&date=${data.today}`

  return (
    <section className="mb-4">
      <Link
        href={href}
        className={cn(
          'block rounded-md border px-3 py-3 no-underline transition-colors',
          moodShell[mood],
          'hover:brightness-[0.98]'
        )}
      >
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <Scale
                className={cn('size-3.5 shrink-0', moodInk[mood])}
                aria-hidden
              />
              <h2 className={cn('text-body font-semibold', moodInk[mood])}>
                {copy.title}
              </h2>
            </div>
            <p className={cn('mt-1 text-body', moodMuted[mood])}>
              {copy.subtitle}
            </p>
          </div>
          <span
            className={cn(
              'inline-flex items-center gap-1 text-hint font-medium',
              moodInk[mood]
            )}
          >
            {copy.cta}
            <ArrowRight className="size-3.5" aria-hidden />
          </span>
        </div>

        <div className="mt-3 grid grid-cols-3 gap-2 border-t border-black/5 pt-3">
          <div>
            <p className={cn('text-hint', moodMuted[mood])}>Pontosság</p>
            <p
              className={cn(
                'mt-0.5 text-[1.35rem] font-semibold tabular-nums leading-none tracking-tight',
                moodInk[mood]
              )}
            >
              {data.summary.accuracyPct == null
                ? '—'
                : `${data.summary.accuracyPct}%`}
            </p>
          </div>
          <div>
            <p className={cn('text-hint', moodMuted[mood])}>Járó bónusz</p>
            <p
              className={cn(
                'mt-0.5 text-[1.35rem] font-semibold tabular-nums leading-none tracking-tight',
                moodInk[mood]
              )}
            >
              {formatReconMoney(data.summary.bonusStaffFt)}
            </p>
            <p className={cn('mt-1 text-hint', moodMuted[mood])}>/ fő</p>
          </div>
          <div>
            <p className={cn('text-hint', moodMuted[mood])}>Sorozat</p>
            <p
              className={cn(
                'mt-0.5 text-[1.35rem] font-semibold tabular-nums leading-none tracking-tight',
                moodInk[mood]
              )}
            >
              {data.summary.streak}
            </p>
            <p className={cn('mt-1 text-hint', moodMuted[mood])}>nap</p>
          </div>
        </div>

        <div className="mt-3">
          <div className="h-1.5 overflow-hidden rounded-full bg-black/10">
            <div
              className={cn(
                'h-full rounded-full transition-[width]',
                moodBar[mood]
              )}
              style={{ width: `${pct}%` }}
            />
          </div>
          <div
            className={cn(
              'mt-1.5 flex flex-wrap justify-between gap-x-2 text-hint',
              moodMuted[mood]
            )}
          >
            <span>
              {data.summary.okCount} OK · {data.summary.varianceCount} eltérés
              {data.summary.missingPastCount > 0
                ? ` · ${data.summary.missingPastCount} hiányzik`
                : ''}
              {data.summary.filledCount < RECON_BONUS.minFilledDays
                ? ` · min. ${RECON_BONUS.minFilledDays} nap`
                : ''}
            </span>
            <span>
              90%→{formatReconMoney(RECON_BONUS.staff90)} · 95%→
              {formatReconMoney(RECON_BONUS.staff95)}
            </span>
          </div>
        </div>
      </Link>
    </section>
  )
}
