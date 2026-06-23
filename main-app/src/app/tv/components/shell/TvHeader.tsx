'use client'

import { formatTvClock, formatTvDate } from '@/lib/tv-format'
import { dayStatusLabel, type TvDayStatus } from '@/lib/tv/day-status'

import styles from './TvHeader.module.css'

type TvHeaderProps = {
  live: boolean
  now: Date
  dayStatus?: TvDayStatus | null
}

export default function TvHeader({ live, now, dayStatus = null }: TvHeaderProps) {
  const statusClass =
    dayStatus === 'critical'
      ? styles.statusCritical
      : dayStatus === 'caution'
        ? styles.statusCaution
        : dayStatus === 'ok'
          ? styles.statusOk
          : ''

  return (
    <header className={`tv-panel ${styles.header}`}>
      <div className={styles.brand}>
        <img src="/images/turinova-logo.png" alt="Turinova" className={styles.logo} />
      </div>
      <div className={styles.center}>
        <div className={styles.date}>{formatTvDate(now)}</div>
        {dayStatus && (
          <span className={`${styles.status} ${statusClass}`}>{dayStatusLabel(dayStatus)}</span>
        )}
      </div>
      <div className={styles.right}>
        <span className={styles.clock}>{formatTvClock(now)}</span>
        <span className={styles.live}>
          <span className={`${styles.dot} ${live ? styles.dotOk : styles.dotErr}`} />
          {live ? 'Élő' : 'Kapcsolat hiba'}
        </span>
      </div>
    </header>
  )
}
