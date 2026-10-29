import { MetricCell, MetricRow } from '@/components/home/home-metric-row'

/** Megrendeléslista elmaradás-szűrő — egyezik getBacklogMeters ablakával. */
export const BACKLOG_ORDERS_HREF = '/megrendelesek?overdue=1'

function formatMeters(n: number) {
  return `${n.toLocaleString('hu-HU', { maximumFractionDigits: 1 })} m`
}

export function BacklogMetersCard({
  cuttingM,
  edgeM,
  orderCount = 0,
  staleOrderCount = 0
}: {
  cuttingM: number
  edgeM: number
  orderCount?: number
  /** >90 napos nyitott lejárat — nem a méter része. */
  staleOrderCount?: number
}) {
  const hasBacklog = orderCount > 0 || cuttingM > 0 || edgeM > 0
  const orderHint =
    staleOrderCount > 0
      ? orderCount > 0
        ? `+ ${staleOrderCount} régebbi (>90 nap)`
        : `${staleOrderCount} régebbi (>90 nap)`
      : orderCount > 0
        ? 'Lejárt gyártási nap, még nem kész'
        : 'Nincs lejárat'

  return (
    <MetricRow
      title="Elmaradás"
      href={BACKLOG_ORDERS_HREF}
      hrefLabel="Megrendelések →"
      cols={3}
    >
      <MetricCell
        label="Szabás"
        value={formatMeters(cuttingM)}
        href={BACKLOG_ORDERS_HREF}
        hint="Lejárt gyártási nap, még nem kész"
        emphasize={cuttingM > 0 ? 'danger' : null}
      />
      <MetricCell
        label="Élzárás"
        value={formatMeters(edgeM)}
        href={BACKLOG_ORDERS_HREF}
        hint="Lejárt gyártási nap, még nem kész"
        emphasize={edgeM > 0 ? 'danger' : null}
      />
      <MetricCell
        label="Megrendelés"
        value={String(orderCount)}
        href={BACKLOG_ORDERS_HREF}
        hint={orderHint}
        emphasize={hasBacklog || staleOrderCount > 0 ? 'danger' : null}
      />
    </MetricRow>
  )
}
