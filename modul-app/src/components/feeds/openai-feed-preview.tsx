'use client'

import { Download } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { toast } from 'sonner'

import { FormSection } from '@/components/patterns/form-section'
import { StatusBadge } from '@/components/patterns/status-badge'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { setFeedExcludedAction } from '@/lib/feeds/openai/actions'
import type { FeedItem, FeedKind } from '@/lib/feeds/openai/build'
import { cn } from '@/lib/utils'

export type PreviewFilter = 'mind' | 'bekerul' | 'kimarad'

type PreviewRow = {
  id: string
  kind: FeedKind
  name: string
  brand: string | null
  excluded: boolean
  reason: string | null
  item: FeedItem | null
}

type Props = {
  loadError: string | null
  included: number
  skippedCount: number
  reasonCounts: [string, number][]
  filter: PreviewFilter
  page: number
  pageCount: number
  canWrite: boolean
  rows: PreviewRow[]
}

const FILTERS: { key: PreviewFilter; label: string }[] = [
  { key: 'mind', label: 'Mind' },
  { key: 'bekerul', label: 'Bekerül' },
  { key: 'kimarad', label: 'Kimarad' }
]

const nf = new Intl.NumberFormat('hu-HU')

function href(filter: PreviewFilter, page: number) {
  const q = new URLSearchParams()
  if (filter !== 'mind') q.set('szuro', filter)
  if (page > 1) q.set('page', String(page))
  const s = q.toString()
  return s ? `?${s}` : '?'
}

export function OpenAiFeedPreview({
  loadError,
  included,
  skippedCount,
  reasonCounts,
  filter,
  page,
  pageCount,
  canWrite,
  rows
}: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  function toggle(row: PreviewRow, excluded: boolean) {
    startTransition(async () => {
      const r = await setFeedExcludedAction(row.kind, row.id, excluded)
      if (!r.ok) {
        toast.error(r.message)
        return
      }
      router.refresh()
    })
  }

  async function downloadSample() {
    const items = rows.flatMap((r) => (r.item ? [r.item] : []))
    const jsonl = items.map((i) => JSON.stringify(i)).join('\n') + '\n'
    const stream = new Blob([jsonl]).stream().pipeThrough(new CompressionStream('gzip'))
    const gz = await new Response(stream).blob()
    const url = URL.createObjectURL(gz)
    const a = document.createElement('a')
    a.href = url
    a.download = 'openai-feed-minta.jsonl.gz'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <FormSection
      title="Előnézet"
      description={`${nf.format(included)} tétel kerül a feedbe, ${nf.format(skippedCount)} kimarad.`}
      columns={1}
      headerAside={
        <Button type="button" variant="secondary" size="sm" onClick={downloadSample} disabled={!rows.some((r) => r.item)}>
          <Download className="size-3.5" aria-hidden />
          Minta letöltése
        </Button>
      }
    >
      {loadError ? <p className="text-body text-danger-ink">{loadError}</p> : null}
      {reasonCounts.length ? (
        <p className="text-hint text-ink-secondary">
          Kimaradás oka: {reasonCounts.map(([label, n]) => `${label} (${nf.format(n)})`).join(', ')}
        </p>
      ) : null}

      <nav className="flex gap-1" aria-label="Szűrő">
        {FILTERS.map((f) => (
          <Link
            key={f.key}
            href={href(f.key, 1)}
            className={cn(
              'rounded-md px-2.5 py-1 text-hint',
              filter === f.key ? 'bg-active-soft text-active-ink' : 'text-ink-secondary hover:bg-subtle'
            )}
            aria-current={filter === f.key ? 'page' : undefined}
          >
            {f.label}
          </Link>
        ))}
      </nav>

      <div className="overflow-x-auto rounded-md border border-border">
        <table className="w-full text-body">
          <thead className="bg-subtle text-left text-hint text-ink-secondary">
            <tr>
              <th className="px-3 py-2 font-medium">Termék (feed cím)</th>
              <th className="px-3 py-2 font-medium">Típus</th>
              <th className="px-3 py-2 text-right font-medium">Ár</th>
              <th className="px-3 py-2 font-medium">Állapot</th>
              <th className="px-3 py-2 font-medium">Feedben</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-ink-secondary">
                  Nincs tétel.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={`${r.kind}-${r.id}`} className="border-t border-border">
                  <td className="px-3 py-1.5">
                    {r.item ? (
                      <a href={r.item.url} target="_blank" rel="noreferrer" className="text-ink hover:underline">
                        {r.item.title}
                      </a>
                    ) : (
                      <span className="text-ink">{[r.brand, r.name].filter(Boolean).join(' ')}</span>
                    )}
                    {r.item?.material ? <span className="ml-1.5 text-hint text-ink-secondary">{r.item.material}</span> : null}
                  </td>
                  <td className="px-3 py-1.5 text-ink-secondary">{r.kind === 'sheet' ? 'Bútorlap' : 'Szálas'}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">
                    {r.item ? `${nf.format(Number(r.item.price.split(' ')[0]))} Ft` : '—'}
                  </td>
                  <td className="px-3 py-1.5">
                    {r.reason ? (
                      <StatusBadge tone={r.excluded ? 'neutral' : 'warning'}>Kimarad: {r.reason}</StatusBadge>
                    ) : (
                      <StatusBadge tone="success">Bekerül</StatusBadge>
                    )}
                  </td>
                  <td className="px-3 py-1.5">
                    <Switch
                      id={`fx-${r.kind}-${r.id}`}
                      checked={!r.excluded}
                      disabled={!canWrite || pending}
                      onCheckedChange={(v) => toggle(r, !v)}
                      label={r.excluded ? 'Kizárva' : 'Engedve'}
                    />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {pageCount > 1 ? (
        <div className="flex items-center justify-end gap-2 text-hint text-ink-secondary">
          <span>
            {page} / {pageCount}
          </span>
          {page > 1 ? (
            <Link href={href(filter, page - 1)} className="rounded-md border border-border px-2.5 py-1 hover:bg-subtle">
              Előző
            </Link>
          ) : null}
          {page < pageCount ? (
            <Link href={href(filter, page + 1)} className="rounded-md border border-border px-2.5 py-1 hover:bg-subtle">
              Következő
            </Link>
          ) : null}
        </div>
      ) : null}
    </FormSection>
  )
}
