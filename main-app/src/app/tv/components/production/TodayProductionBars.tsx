'use client'

import type { TvTodayProductionBlock } from '@/types/tv-dashboard'
import type { TvTomorrowLoad } from '@/lib/tv/day-status'
import { formatTvMeters } from '@/lib/tv-format'

import styles from './TodayProductionBars.module.css'

type TodayProductionBarsProps = {
  today: TvTodayProductionBlock
  tomorrow?: TvTomorrowLoad | null
  /** Portrait sidebar — vertical stack */
  sidebar?: boolean
}

function fmtM(v: number): string {
  return formatTvMeters(v)
}

function MeterBar({
  label,
  total,
  done,
  remaining,
  capacityPct
}: {
  label: string
  total: number
  done: number
  remaining: number
  capacityPct?: number | null
}) {
  const sum = done + remaining
  const base = total > 0 ? total : sum
  const donePct = base > 0 ? Math.min(100, (done / base) * 100) : 0
  const remainPct = base > 0 ? Math.min(100 - donePct, (remaining / base) * 100) : 0

  const capWarn =
    capacityPct != null && capacityPct > 100
      ? styles.capWarn
      : capacityPct != null && capacityPct >= 85
        ? styles.capCaution
        : ''

  return (
    <div className={styles.block}>
      <div className={styles.blockHead}>
        <span className={styles.blockLabel}>{label}</span>
        <span className={styles.blockTotal}>{base > 0 ? fmtM(base) : '—'}</span>
      </div>
      <div className={styles.track}>
        {donePct > 0 && (
          <div className={styles.segmentDone} style={{ width: `${donePct}%` }} title={`Kész: ${fmtM(done)}`} />
        )}
        {remainPct > 0 && (
          <div
            className={styles.segmentRemain}
            style={{ width: `${remainPct}%` }}
            title={`Hátra: ${fmtM(remaining)}`}
          />
        )}
        {base <= 0 && <div className={styles.segmentEmpty} />}
      </div>
      <div className={styles.blockFoot}>
        <span className={styles.footDone}>Kész {fmtM(done)}</span>
        <span className={styles.footRemain}>Hátra {fmtM(remaining)}</span>
        {capacityPct != null && (
          <span className={`${styles.footCap} ${capWarn}`}>{Math.round(capacityPct)}%</span>
        )}
      </div>
    </div>
  )
}

export default function TodayProductionBars({
  today,
  tomorrow = null,
  sidebar = false
}: TodayProductionBarsProps) {
  const hasToday = today.edgeCapacityPct != null

  return (
    <div className={`tv-panel tv-panel-accent ${styles.wrap} ${sidebar ? styles.wrapSidebar : ''}`}>
      <h2 className={styles.title}>Ma</h2>
      {hasToday ? (
        <>
          <div className={styles.bars}>
            <MeterBar
              label="Szabás"
              total={today.cuttingTotalM}
              done={today.cuttingDoneM}
              remaining={today.cuttingRemainingM}
            />
            <MeterBar
              label="Élzárás"
              total={today.edgeTotalM}
              done={today.edgeDoneM}
              remaining={today.edgeRemainingM}
              capacityPct={today.edgeCapacityPct}
            />
          </div>
          {tomorrow && (
            <p className={styles.tomorrow}>
              Holnap: {formatTvMeters(tomorrow.cuttingM)} szabás · {formatTvMeters(tomorrow.edgeM)} élzárás
            </p>
          )}
        </>
      ) : (
        <p className={styles.empty}>Ma nincs gyártási nap (hétvége)</p>
      )}
    </div>
  )
}
