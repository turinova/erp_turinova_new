import { MetricCell, MetricRow } from '@/components/home/home-metric-row'

function formatMeters(n: number) {
  return `${n.toLocaleString('hu-HU', { maximumFractionDigits: 1 })} m`
}

export function BacklogMetersCard({
  cuttingM,
  edgeM,
  overdueOrderCount = 0
}: {
  cuttingM: number
  edgeM: number
  /** Nyitott lapszabászat megrendelés tegnap előtti dátummal */
  overdueOrderCount?: number
}) {
  return (
    <MetricRow
      title="Elmaradás"
      href="/megrendelesek?status=all"
      hrefLabel="Megrendelések →"
      cols={3}
    >
      <MetricCell
        label="Szabás"
        value={formatMeters(cuttingM)}
        href="/megrendelesek?status=all"
        hint="Múlt napok, kész nélkül"
        emphasize={cuttingM > 0 ? 'danger' : null}
      />
      <MetricCell
        label="Élzárás"
        value={formatMeters(edgeM)}
        href="/megrendelesek?status=all"
        hint="Múlt napok, kész nélkül"
        emphasize={edgeM > 0 ? 'danger' : null}
      />
      <MetricCell
        label="Megrendelés"
        value={String(overdueOrderCount)}
        href="/megrendelesek?status=all"
        hint={overdueOrderCount > 0 ? 'Lejárt gyártási dátum' : 'Nincs lejárat'}
        emphasize={overdueOrderCount > 0 ? 'danger' : null}
      />
    </MetricRow>
  )
}
