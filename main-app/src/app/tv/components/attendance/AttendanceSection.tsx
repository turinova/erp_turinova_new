'use client'

import { useMemo } from 'react'

import type { TvAttendanceBlock, TvAttendanceRow, TvAttendanceStatus } from '@/types/tv-dashboard'
import {
  compactStatusLabel,
  sortCompact,
  sortDetailed,
  splitAttendance,
  splitAttendanceNameLines,
  summarizeAttendance
} from '@/lib/tv/attendance-display'

import styles from './AttendanceSection.module.css'

type AttendanceSectionProps = {
  attendance: TvAttendanceBlock
  /** TV kiosk: Be/Ki időkkel, kompakt grid */
  tv?: boolean
  /** Portrait sidebar — compact table rows */
  sidebar?: boolean
}

function chipStatusClass(status: TvAttendanceStatus): string {
  if (status === 'in' || status === 'late') return styles.chipIn
  if (status === 'left') return styles.chipLeft
  return styles.chipLeft
}

function compactChipClass(status: TvAttendanceStatus): string {
  if (status === 'holiday') return styles.compactHoliday
  if (status === 'sick') return styles.compactSick
  if (status === 'none') return styles.compactNone
  return styles.compactOdd
}

function AttendanceName({ name, className }: { name: string; className?: string }) {
  const lines = splitAttendanceNameLines(name)
  return (
    <span className={`${styles.nameBlock} ${className ?? ''}`}>
      {lines.map((line, i) => (
        <span key={i} className={styles.nameLine}>
          {line}
        </span>
      ))}
    </span>
  )
}

function DetailedChip({ row, tv }: { row: TvAttendanceRow; tv?: boolean }) {
  return (
    <div className={`${styles.chip} ${tv ? styles.chipTv : ''} ${chipStatusClass(row.status)}`}>
      <AttendanceName name={row.name} className={styles.chipName} />
      <div className={styles.chipTimes}>
        <span className={styles.timeBlock}>
          <span className={styles.timeLabel}>Be</span>
          <span className={styles.timeValue}>{row.arrival ?? '—'}</span>
        </span>
        <span className={styles.timeBlock}>
          <span className={styles.timeLabel}>Ki</span>
          <span className={styles.timeValue}>{row.departure ?? '—'}</span>
        </span>
      </div>
    </div>
  )
}

function CompactChip({ row, tv }: { row: TvAttendanceRow; tv?: boolean }) {
  return (
    <div className={`${styles.compactChip} ${tv ? styles.compactChipTv : ''} ${compactChipClass(row.status)}`}>
      <AttendanceName name={row.name} className={styles.compactName} />
      <span className={styles.compactStatus}>{compactStatusLabel(row)}</span>
    </div>
  )
}

function SidebarRow({ row }: { row: TvAttendanceRow }) {
  const hasTimes = row.arrival != null || row.departure != null
  const statusClass = hasTimes ? chipStatusClass(row.status) : compactChipClass(row.status)

  return (
    <div className={`${styles.sidebarRow} ${statusClass}`}>
      <AttendanceName name={row.name} className={styles.sidebarName} />
      {hasTimes ? (
        <>
          <span className={styles.sidebarTime}>{row.arrival ?? '—'}</span>
          <span className={styles.sidebarTime}>{row.departure ?? '—'}</span>
        </>
      ) : (
        <span className={styles.sidebarStatusOnly}>{compactStatusLabel(row)}</span>
      )}
    </div>
  )
}

export default function AttendanceSection({ attendance, tv = false, sidebar = false }: AttendanceSectionProps) {
  const { detailed, compact: compactRows } = useMemo(
    () => splitAttendance(attendance.employees),
    [attendance.employees]
  )
  const detailedSorted = useMemo(() => sortDetailed(detailed), [detailed])
  const compactSorted = useMemo(() => sortCompact(compactRows), [compactRows])
  const counts = useMemo(() => summarizeAttendance(attendance.employees), [attendance.employees])
  const allSorted = useMemo(
    () => [...sortDetailed(detailed), ...sortCompact(compactRows)],
    [detailed, compactRows]
  )

  const pills = (
    <div className={`${styles.pills} ${tv || sidebar ? styles.pillsKiosk : ''}`}>
      {counts.in > 0 && (
        <span className={`${styles.pill} ${styles.pillIn}`}>Bent {counts.in}</span>
      )}
      {counts.late > 0 && (
        <span className={`${styles.pill} ${styles.pillLate}`}>Késő {counts.late}</span>
      )}
      {counts.left > 0 && !tv && !sidebar && (
        <span className={`${styles.pill} ${styles.pillLeft}`}>Távozott {counts.left}</span>
      )}
      {counts.holiday > 0 && (
        <span className={`${styles.pill} ${styles.pillHoliday}`}>
          {tv || sidebar ? `Szab. ${counts.holiday}` : `Szabadság ${counts.holiday}`}
        </span>
      )}
      {counts.sick > 0 && <span className={`${styles.pill} ${styles.pillSick}`}>Beteg {counts.sick}</span>}
      {counts.none > 0 && (
        <span className={`${styles.pill} ${styles.pillNone}`}>
          {tv || sidebar ? `Nincs ${counts.none}` : `Nem jelent meg ${counts.none}`}
        </span>
      )}
    </div>
  )

  if (sidebar) {
    return (
      <section className={`tv-panel tv-panel-accent ${styles.wrap} ${styles.wrapSidebar}`}>
        <div className={`${styles.head} ${styles.headTv} ${styles.headSidebar}`}>
          <h2 className={styles.title}>Jelenlét</h2>
          {pills}
        </div>
        <div className={styles.sidebarBody}>
          <div className={styles.sidebarHead}>
            <span>Név</span>
            <span>Be</span>
            <span>Ki</span>
          </div>
          <div className={styles.sidebarRows}>
            {allSorted.map(row => (
              <SidebarRow key={row.id} row={row} />
            ))}
          </div>
        </div>
      </section>
    )
  }

  return (
    <section className={`tv-panel tv-panel-accent ${styles.wrap} ${tv ? styles.wrapTv : ''}`}>
      <div className={`${styles.head} ${tv ? styles.headTv : ''}`}>
        <h2 className={styles.title}>Jelenlét</h2>
        {!tv && <div className={styles.dateLabel}>{attendance.dateLabel}</div>}
        {pills}
      </div>

      <div className={`${styles.body} ${tv ? styles.bodyTv : ''}`}>
        {detailedSorted.length > 0 && (
          <div className={styles.chipGrid}>
            {detailedSorted.map(row => (
              <DetailedChip key={row.id} row={row} tv={tv} />
            ))}
          </div>
        )}
        {compactSorted.length > 0 && (
          <div className={styles.compactGrid}>
            {compactSorted.map(row => (
              <CompactChip key={row.id} row={row} tv={tv} />
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
