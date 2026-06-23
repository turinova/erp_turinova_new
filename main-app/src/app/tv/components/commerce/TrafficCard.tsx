'use client'

import { useMemo } from 'react'

import type { TvFootcounterBlock } from '@/types/tv-dashboard'
import { formatTvCount } from '@/lib/tv-format'
import { buildTrafficAreaOption } from '@/lib/tv/echarts-tv-theme'

import { useTvPreviewMode } from '../../hooks/useTvPreviewMode'
import EChart from '../EChart'
import styles from './TrafficCard.module.css'

type TrafficCardProps = {
  footcounter: TvFootcounterBlock | null
  /** Portrait sidebar — vertical stack (legacy) */
  sidebar?: boolean
  /** Portrait left column — wide chart row */
  portraitLeft?: boolean
}

export default function TrafficCard({ footcounter, sidebar = false, portraitLeft = false }: TrafficCardProps) {
  const { isKiosk } = useTvPreviewMode()
  const density = isKiosk ? 'kiosk' : 'laptop'

  const areaOption = useMemo(() => {
    if (!footcounter) return null
    return buildTrafficAreaOption(footcounter.hourLabels, footcounter.hourlyOpen, density)
  }, [footcounter, density])

  if (!footcounter) {
    return (
      <div className={`tv-panel tv-panel-accent ${styles.wrap}`}>
        <span className={styles.kpiTitle}>Forgalom</span>
        <span className={styles.empty}>Nincs adat</span>
      </div>
    )
  }

  const moodClass =
    footcounter.mood === 'busy' ? styles.moodBusy : footcounter.mood === 'quiet' ? styles.moodQuiet : styles.mood

  const compact = sidebar || portraitLeft

  return (
    <div
      className={`tv-panel tv-panel-accent ${styles.wrap} ${sidebar ? styles.wrapSidebar : ''} ${portraitLeft ? styles.wrapPortraitLeft : ''}`}
    >
      <div
        className={`${styles.row} ${sidebar ? styles.rowSidebar : ''} ${portraitLeft ? styles.rowPortraitLeft : ''}`}
      >
        <div
          className={`${styles.statsCol} ${sidebar ? styles.statsColSidebar : ''} ${portraitLeft ? styles.statsColPortraitLeft : ''}`}
        >
          <span className={styles.kpiTitle}>Forgalom</span>
          <div className={`${styles.kpiStats} ${sidebar ? styles.kpiStatsSidebar : ''}`}>
            <div className={styles.kpiItem}>
              <span className={styles.kpiLabel}>Belépő</span>
              <span
                className={`${styles.kpiValue} ${sidebar ? styles.kpiValueSidebar : ''} ${portraitLeft ? styles.kpiValuePortraitLeft : ''}`}
              >
                {formatTvCount(footcounter.todayIn)}
              </span>
            </div>
            {!compact && (
              <>
                <div className={styles.kpiItem}>
                  <span className={styles.kpiLabel}>Kilépő</span>
                  <span className={styles.kpiValueMuted}>{formatTvCount(footcounter.todayOut)}</span>
                </div>
                {footcounter.avgIn != null && (
                  <div className={styles.kpiItem}>
                    <span className={styles.kpiLabel}>Átlag</span>
                    <span className={styles.kpiValueMuted}>{formatTvCount(Math.round(footcounter.avgIn))}</span>
                  </div>
                )}
              </>
            )}
          </div>
          <div className={styles.moodRow}>
            <span className={`${styles.mood} ${moodClass}`}>{footcounter.moodLabel}</span>
            {!footcounter.online && <span className={styles.offline}>Offline</span>}
          </div>
        </div>
        <div
          className={`${styles.chartCol} ${sidebar ? styles.chartColSidebar : ''} ${portraitLeft ? styles.chartColPortraitLeft : ''}`}
        >
          {!sidebar && <span className={styles.chartTitle}>Óránkénti belépők (8:00–17:00)</span>}
          <div className={styles.chartBox}>{areaOption && <EChart option={areaOption} />}</div>
        </div>
      </div>
    </div>
  )
}
