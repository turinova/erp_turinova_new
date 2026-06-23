'use client'

import type { TvBacklogBlock } from '@/types/tv-dashboard'
import { formatTvCount, formatTvMeters } from '@/lib/tv-format'

import styles from './BacklogHeroCard.module.css'

type BacklogHeroCardProps = {
  backlog: TvBacklogBlock
  variant?: 'stacked' | 'strip'
  /** Portrait sidebar — compact vertical stack */
  sidebar?: boolean
}

function Tile({
  variant,
  label,
  meters,
  orders
}: {
  variant: 'cutting' | 'edge'
  label: string
  meters: number
  orders: number
}) {
  return (
    <div className={`${styles.card} ${variant === 'cutting' ? styles.cutting : styles.edge}`}>
      <div className={styles.label}>Lejárt · {label}</div>
      <div className={styles.hero}>{formatTvMeters(meters)}</div>
      <div className={styles.orders}>{formatTvCount(orders)} rendelés</div>
    </div>
  )
}

function StripTile({
  variant,
  label,
  meters,
  orders
}: {
  variant: 'cutting' | 'edge'
  label: string
  meters: number
  orders: number
}) {
  return (
    <div className={`${styles.stripTile} ${variant === 'cutting' ? styles.cutting : styles.edge}`}>
      <span className={styles.stripLabel}>{label}</span>
      <span className={styles.stripHero}>{formatTvMeters(meters)}</span>
      <span className={styles.stripOrders}>{formatTvCount(orders)} rend.</span>
    </div>
  )
}

export default function BacklogHeroCard({ backlog, variant = 'stacked', sidebar = false }: BacklogHeroCardProps) {
  if (variant === 'strip') {
    return (
      <div className={`tv-panel tv-panel-accent ${styles.strip}`}>
        <span className={styles.stripBefore}>Lejárt napok · gyártás &lt; {backlog.before}</span>
        <StripTile variant="cutting" label="Szabás" meters={backlog.cuttingM} orders={backlog.cuttingOrderCount} />
        <div className={styles.stripDivider} />
        <StripTile variant="edge" label="Élzárás" meters={backlog.edgeM} orders={backlog.edgeOrderCount} />
      </div>
    )
  }

  return (
    <div className={`tv-panel tv-panel-accent ${styles.row} ${sidebar ? styles.rowSidebar : ''}`}>
      <p className={styles.before}>Lejárt napok · gyártás &lt; {backlog.before}</p>
      <div className={`${styles.tiles} ${sidebar ? styles.tilesSidebar : ''}`}>
        <Tile variant="cutting" label="Szabás" meters={backlog.cuttingM} orders={backlog.cuttingOrderCount} />
        <Tile variant="edge" label="Élzárás" meters={backlog.edgeM} orders={backlog.edgeOrderCount} />
      </div>
    </div>
  )
}
