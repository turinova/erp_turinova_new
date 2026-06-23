'use client'

import { useMemo } from 'react'

import { computeDayStatus, getTomorrowLoad } from '@/lib/tv/day-status'

import AttendanceSection from './components/attendance/AttendanceSection'
import TrafficCard from './components/commerce/TrafficCard'
import BacklogHeroCard from './components/production/BacklogHeroCard'
import TodayProductionBars from './components/production/TodayProductionBars'
import WeeklyProductionChart from './components/production/WeeklyStackedBarChart'
import TvHeader from './components/shell/TvHeader'
import { useTvClock } from './hooks/useTvClock'
import { useTvDashboard } from './hooks/useTvDashboard'
import { useTvPreviewMode } from './hooks/useTvPreviewMode'
import shell from './styles/tv.shell.module.css'

export default function TvDashboard() {
  const { data, loading, error } = useTvDashboard()
  const now = useTvClock()
  const { isKiosk, isPortrait } = useTvPreviewMode()
  const live = !error && !loading && !!data

  const dayStatus = useMemo(() => (data ? computeDayStatus(data) : null), [data])
  const tomorrow = useMemo(() => (data ? getTomorrowLoad(data) : null), [data])

  if (loading && !data) {
    return (
      <div className={shell.loadingCenter}>
        <p>Betöltés…</p>
      </div>
    )
  }

  if (error && !data) {
    return (
      <div className={shell.errorCenter}>
        <p style={{ color: 'var(--tv-danger)', fontSize: 'var(--tv-font-title)', fontWeight: 800 }}>
          Nem sikerült betölteni az adatokat
        </p>
        <p style={{ color: 'var(--tv-text-muted)' }}>{error}</p>
        <p>Ellenőrizd a bejelentkezést és a /tv jogosultságot.</p>
      </div>
    )
  }

  if (!data) return null

  const shellClass = [
    'tv-shell',
    shell.shell,
    isKiosk ? shell.shellKiosk : '',
    isPortrait ? shell.shellPortrait : shell.shellLandscape
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div className={shellClass}>
      <TvHeader live={live} now={now} dayStatus={dayStatus} />

      <div className={shell.portraitMain}>
        <div className={shell.portraitLeft}>
          <section className={shell.chartRow}>
            <WeeklyProductionChart title="Heti szabás mennyiség" variant="cutting" chart={data.weeklyCutting} />
          </section>
          <section className={shell.chartRow}>
            <WeeklyProductionChart title="Heti élzárás mennyiség" variant="edge" chart={data.weeklyEdge} />
          </section>
          <section className={shell.portraitTraffic}>
            <TrafficCard footcounter={data.footcounter} portraitLeft />
          </section>
        </div>

        <aside className={shell.portraitSidebar}>
          <section className={shell.sidebarToday}>
            <TodayProductionBars today={data.todayProduction} tomorrow={tomorrow} sidebar />
          </section>
          <section className={shell.sidebarBacklog}>
            <BacklogHeroCard backlog={data.backlog} variant="stacked" sidebar />
          </section>
          <section className={shell.sidebarAttendance}>
            <AttendanceSection
              attendance={data.attendance}
              tv
              sidebar
              twoColumn={!isPortrait}
            />
          </section>
        </aside>
      </div>
    </div>
  )
}
