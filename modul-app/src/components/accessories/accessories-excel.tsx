'use client'

import { CircleAlert, Download, Info, Upload } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'

import { StatusBadge, type StatusBadgeTone } from '@/components/patterns/status-badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { ACCESSORY_IMPORT_MAX_BYTES, ACCESSORY_IMPORT_MAX_ROWS } from '@/lib/accessories/excel-columns'
import {
  itemHasError,
  type AccessoryImportDecision,
  type AccessoryImportDecisions,
  type AccessoryImportItem,
  type AccessoryImportPending,
  type AccessoryImportPreview,
  type AccessoryImportResult,
  type AccessoryImportStatus
} from '@/lib/accessories/import-types'
import { cn } from '@/lib/utils'

const TABLE_LIMIT = 200
/** Ennyi módosítás fölött külön figyelmeztetünk a mentés letöltésére. */
const BIG_CHANGE = 200

type ItemFilter = 'all' | 'create' | 'update' | 'error' | 'warning'

const ITEM_FILTER_LABEL: Record<ItemFilter, string> = {
  all: 'Mind',
  create: 'Új',
  update: 'Frissül',
  error: 'Hibás',
  warning: 'Figyelem'
}

const STATUS_LABEL: Record<AccessoryImportStatus, { text: string; tone: StatusBadgeTone }> = {
  create: { text: 'Új', tone: 'success' },
  update: { text: 'Frissül', tone: 'info' },
  unchanged: { text: 'Nem változik', tone: 'neutral' },
  error: { text: 'Kimarad', tone: 'danger' }
}

const LEVEL_PREFIX = { error: 'Hiba', warning: 'Figyelem', info: 'Infó' } as const

function matchesItem(item: AccessoryImportItem, f: ItemFilter): boolean {
  switch (f) {
    case 'all':
      return true
    case 'create':
      return item.status === 'create'
    case 'update':
      return item.status === 'update'
    case 'error':
      return itemHasError(item)
    case 'warning':
      return item.issues.some((i) => i.level === 'warning')
  }
}

const n = (v: number) => v.toLocaleString('hu-HU')

function summary(p: AccessoryImportPreview): string {
  const s = p.stats
  const parts = [`${n(s.rows)} sor a fájlban`]
  if (s.create > 0) parts.push(`${n(s.create)} új termék lesz`)
  if (s.update > 0) parts.push(`${n(s.update)} frissül`)
  if (s.unchanged > 0) parts.push(`${n(s.unchanged)} nem változik`)
  if (s.partial > 0) parts.push(`${n(s.partial)}-nál egy-egy hibás mező kimarad`)
  if (s.error > 0) parts.push(`${n(s.error)} sor teljesen kimarad`)
  return `${parts.join(', ')}.`
}

async function saveBlob(response: Response, fallback: string) {
  const blob = await response.blob()
  const match = response.headers.get('Content-Disposition')?.match(/filename="([^"]+)"/)
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = match?.[1] ?? fallback
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

async function errorOf(response: Response, fallback: string): Promise<string> {
  const data = (await response.json().catch(() => null)) as { error?: string } | null
  return data?.error || fallback
}

export function AccessoriesExcel({ canWrite }: { canWrite: boolean }) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)

  const [exportOpen, setExportOpen] = useState(false)
  const [exportMode, setExportMode] = useState<'data' | 'template'>('data')
  const [exportBusy, setExportBusy] = useState(false)

  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<AccessoryImportPreview | null>(null)
  const [decisions, setDecisions] = useState<AccessoryImportDecisions>({})
  const [result, setResult] = useState<AccessoryImportResult | null>(null)
  const [busy, setBusy] = useState<null | 'preview' | 'apply' | 'backup' | 'problems'>(null)
  const [itemFilter, setItemFilter] = useState<ItemFilter>('all')
  const [backedUp, setBackedUp] = useState(false)

  const open = Boolean(preview || result)

  async function download(mode: 'data' | 'template', after?: () => void) {
    const response = await fetch(`/api/accessories/export?mode=${mode}`)
    if (!response.ok) {
      toast.error(await errorOf(response, 'A letöltés nem sikerült.'))
      return false
    }
    await saveBlob(response, mode === 'template' ? 'termekek_sablon.xlsx' : 'termekek.xlsx')
    after?.()
    return true
  }

  async function runExport() {
    setExportBusy(true)
    try {
      if (await download(exportMode)) {
        toast.success(exportMode === 'template' ? 'Üres sablon letöltve.' : 'Letöltve. Írd át, majd töltsd fel.')
        setExportOpen(false)
      }
    } catch {
      toast.error('A letöltés nem sikerült.')
    } finally {
      setExportBusy(false)
    }
  }

  async function requestPreview(f: File, d: AccessoryImportDecisions) {
    setBusy('preview')
    try {
      const form = new FormData()
      form.append('file', f)
      form.append('decisions', JSON.stringify(d))
      const response = await fetch('/api/accessories/import/preview', { method: 'POST', body: form })
      if (!response.ok) {
        toast.error(await errorOf(response, 'Az előnézet nem sikerült.'))
        return false
      }
      setPreview((await response.json()) as AccessoryImportPreview)
      return true
    } catch {
      toast.error('Az előnézet nem sikerült. Ellenőrizd a kapcsolatot, és próbáld újra.')
      return false
    } finally {
      setBusy(null)
    }
  }

  async function onFile(event: React.ChangeEvent<HTMLInputElement>) {
    const f = event.target.files?.[0]
    event.target.value = ''
    if (!f) return
    if (!f.name.toLowerCase().endsWith('.xlsx')) {
      toast.error('Csak .xlsx fájl tölthető fel. Excelben: Fájl → Mentés másként → Excel-munkafüzet.')
      return
    }
    if (f.size > ACCESSORY_IMPORT_MAX_BYTES) {
      toast.error('A fájl nagyobb 4 MB-nál. Oszd két fájlra.')
      return
    }
    setResult(null)
    setDecisions({})
    setItemFilter('all')
    setBackedUp(false)
    if (await requestPreview(f, {})) setFile(f)
  }

  async function decide(key: string, choice: AccessoryImportDecision | null) {
    if (!file) return
    const next = { ...decisions }
    if (choice) next[key] = choice
    else delete next[key]
    setDecisions(next)
    await requestPreview(file, next)
  }

  async function apply() {
    if (!file || !preview) return
    setBusy('apply')
    try {
      const form = new FormData()
      form.append('file', file)
      form.append('decisions', JSON.stringify(decisions))
      const response = await fetch('/api/accessories/import', { method: 'POST', body: form })
      if (!response.ok) {
        toast.error(await errorOf(response, 'A mentés nem sikerült.'))
        return
      }
      const r = (await response.json()) as AccessoryImportResult
      setResult(r)
      setPreview(null)
      toast[r.failed.length > 0 ? 'warning' : 'success'](
        `${n(r.created)} új, ${n(r.updated)} frissítve.`
      )
      router.refresh()
    } catch {
      toast.error('A kapcsolat megszakadt. Töltsd fel újra ugyanezt a fájlt — a már mentett sorok nem duplázódnak.')
    } finally {
      setBusy(null)
    }
  }

  async function downloadBackup() {
    setBusy('backup')
    try {
      if (await download('data')) {
        setBackedUp(true)
        toast.success('A mostani állapot letöltve. Ezt visszatöltve visszaállíthatod.')
      }
    } catch {
      toast.error('A letöltés nem sikerült.')
    } finally {
      setBusy(null)
    }
  }

  async function downloadProblems() {
    if (!file) return
    setBusy('problems')
    try {
      const form = new FormData()
      form.append('file', file)
      form.append('decisions', JSON.stringify(decisions))
      form.append('failed', JSON.stringify(result?.failed ?? []))
      const response = await fetch('/api/accessories/import/problems', { method: 'POST', body: form })
      if (!response.ok) {
        toast.error(await errorOf(response, 'A letöltés nem sikerült.'))
        return
      }
      await saveBlob(response, 'termekek_hibas_sorok.xlsx')
    } catch {
      toast.error('A letöltés nem sikerült.')
    } finally {
      setBusy(null)
    }
  }

  function close() {
    if (busy === 'apply') return
    setPreview(null)
    setResult(null)
    setFile(null)
    setDecisions({})
  }

  const counts = useMemo(() => {
    const items = preview?.items ?? []
    return Object.fromEntries(
      (Object.keys(ITEM_FILTER_LABEL) as ItemFilter[]).map((f) => [f, items.filter((i) => matchesItem(i, f)).length])
    ) as Record<ItemFilter, number>
  }, [preview])

  const visible = useMemo(
    () => (preview?.items ?? []).filter((i) => matchesItem(i, itemFilter)),
    [preview, itemFilter]
  )

  const toSave = preview ? preview.stats.create + preview.stats.update : 0
  const problemRows = preview ? preview.items.filter(itemHasError).length : 0

  return (
    <>
      <Button type="button" variant="secondary" onClick={() => setExportOpen(true)}>
        <Download className="size-3.5" aria-hidden />
        Letöltöm Excelben
      </Button>
      {canWrite ? (
        <>
          <Button
            type="button"
            variant="secondary"
            loading={busy === 'preview' && !preview}
            onClick={() => inputRef.current?.click()}
          >
            <Upload className="size-3.5" aria-hidden />
            Feltöltöm az Excelt
          </Button>
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="sr-only"
            onChange={onFile}
          />
        </>
      ) : null}

      <Dialog open={exportOpen} onOpenChange={(o) => !exportBusy && setExportOpen(o)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Termékek letöltése Excelben</DialogTitle>
            <DialogDescription>
              Írd át Excelben, majd töltsd fel itt. Egy fájlban legfeljebb {n(ACCESSORY_IMPORT_MAX_ROWS)} termék lehet.
            </DialogDescription>
          </DialogHeader>
          <fieldset className="space-y-2">
            <legend className="sr-only">Mit töltesz le?</legend>
            {(
              [
                ['data', 'Minden termék', 'A mostani termékek, szerkeszthető formában. Ebből tudsz árat, nevet, vonalkódot tömegesen módosítani.'],
                ['template', 'Üres sablon', 'Egy mintasorral. Új termékek felviteléhez.']
              ] as const
            ).map(([value, label, hint]) => (
              <label
                key={value}
                className={cn(
                  'flex cursor-pointer gap-2 rounded-md border px-3 py-2',
                  exportMode === value ? 'border-primary bg-subtle' : 'border-border'
                )}
              >
                <input
                  type="radio"
                  name="accessory-export-mode"
                  className="mt-0.5 size-4 accent-primary"
                  checked={exportMode === value}
                  onChange={() => setExportMode(value)}
                />
                <span>
                  <span className="block text-body font-medium text-ink">{label}</span>
                  <span className="block text-hint text-ink-secondary">{hint}</span>
                </span>
              </label>
            ))}
          </fieldset>
          <DialogFooter className="gap-2">
            <Button type="button" variant="secondary" disabled={exportBusy} onClick={() => setExportOpen(false)}>
              Mégse
            </Button>
            <Button type="button" loading={exportBusy} onClick={runExport}>
              Letöltöm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={open} onOpenChange={(o) => !o && close()}>
        <DialogContent className="flex max-h-[92vh] max-w-5xl flex-col">
          {result ? (
            <ResultView result={result} busy={busy} onProblems={downloadProblems} onClose={close} />
          ) : preview ? (
            <>
              <DialogHeader>
                <DialogTitle>Mi fog történni?</DialogTitle>
                <DialogDescription>
                  Még semmi nincs elmentve. Nézd át, döntsd el a kérdéseket, majd mentsd.
                </DialogDescription>
              </DialogHeader>

              <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1" aria-busy={busy !== null}>
                <p className="text-body text-ink">{summary(preview)}</p>

                {preview.notices.length > 0 ? (
                  <ul className="space-y-1 rounded-md border border-border bg-subtle px-3 py-2 text-hint text-ink-secondary">
                    {preview.notices.map((notice) => (
                      <li key={notice} className="flex gap-1.5">
                        <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                        {notice}
                      </li>
                    ))}
                  </ul>
                ) : null}

                {preview.pending.length > 0 ? (
                  <PendingList pending={preview.pending} disabled={busy !== null} onDecide={decide} />
                ) : null}

                {toSave >= BIG_CHANGE && !backedUp ? (
                  <p className="flex gap-1.5 rounded-md border border-warning/30 bg-warning-soft px-3 py-2 text-hint text-warning-ink">
                    <CircleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                    Sok termék változik. Mentés előtt töltsd le a jelenlegi állapotot (lent balra) — ha valami rosszul sül el,
                    azt visszatöltve minden visszaáll.
                  </p>
                ) : null}

                {busy === 'apply' ? (
                  <p className="rounded-md border border-border bg-subtle px-3 py-2 text-body text-ink" role="status">
                    Mentés folyamatban… {n(toSave)} termék — több ezer sornál ez egy-két percig is tarthat. Ne zárd be az ablakot.
                  </p>
                ) : null}

                <nav className="flex flex-wrap gap-1.5" aria-label="Sorok szűrése">
                  {(Object.keys(ITEM_FILTER_LABEL) as ItemFilter[]).map((f) => (
                    <button
                      key={f}
                      type="button"
                      aria-pressed={itemFilter === f}
                      onClick={() => setItemFilter(f)}
                      className={cn(
                        'inline-flex h-7 items-center gap-1 rounded-md border px-2.5 text-hint font-medium',
                        itemFilter === f
                          ? 'border-primary bg-primary text-white'
                          : 'border-border bg-surface text-ink-secondary hover:bg-subtle'
                      )}
                    >
                      {ITEM_FILTER_LABEL[f]}
                      <span className="tabular-nums opacity-80">{n(counts[f])}</span>
                    </button>
                  ))}
                </nav>

                <ItemTable items={visible} unchanged={itemFilter === 'all' ? preview.stats.unchanged : 0} />
              </div>

              <DialogFooter className="flex-wrap gap-2 sm:justify-between">
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    loading={busy === 'backup'}
                    disabled={busy !== null}
                    onClick={downloadBackup}
                  >
                    Jelenlegi állapot letöltése
                  </Button>
                  {problemRows > 0 ? (
                    <Button
                      type="button"
                      variant="ghost"
                      loading={busy === 'problems'}
                      disabled={busy !== null}
                      onClick={downloadProblems}
                    >
                      Hibás sorok letöltése ({n(problemRows)})
                    </Button>
                  ) : null}
                </div>
                <div className="flex gap-2">
                  <Button type="button" variant="secondary" disabled={busy === 'apply'} onClick={close}>
                    Mégse
                  </Button>
                  <Button
                    type="button"
                    loading={busy === 'apply'}
                    disabled={busy !== null || toSave === 0}
                    onClick={apply}
                  >
                    {toSave > 0 ? `${n(toSave)} termék mentése` : 'Nincs mit menteni'}
                  </Button>
                </div>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  )
}

function PendingList({
  pending,
  disabled,
  onDecide
}: {
  pending: AccessoryImportPending[]
  disabled: boolean
  onDecide: (key: string, choice: AccessoryImportDecision | null) => void
}) {
  return (
    <section className="rounded-md border border-warning/30 bg-warning-soft px-3 py-2" aria-label="Döntés kell">
      <h3 className="mb-1 flex items-center gap-1.5 text-body font-medium text-warning-ink">
        <CircleAlert className="size-3.5 shrink-0" aria-hidden />
        Döntés kell ({pending.length}) — ezek a gyártók még nincsenek meg
      </h3>
      <p className="mb-2 text-hint text-warning-ink">
        Magunktól semmit nem hozunk létre. Ha kihagyod: az új termékek ezzel a gyártóval kimaradnak, a meglévőknél a
        gyártó nem változik.
      </p>
      <ul className="space-y-2">
        {pending.map((p) => {
          const name = `pending-${p.key}`
          const opt = (value: AccessoryImportDecision | null, label: string) => (
            <label className="flex cursor-pointer items-center gap-1.5 text-hint text-ink">
              <input
                type="radio"
                name={name}
                className="size-3.5 accent-primary"
                checked={p.choice === value}
                disabled={disabled}
                onChange={() => onDecide(p.key, value)}
              />
              {label}
            </label>
          )
          return (
            <li key={p.key} className="rounded-md border border-border bg-surface px-2.5 py-2">
              <p className="text-body text-ink">
                <span className="text-ink-secondary">Gyártó:</span> <span className="font-medium">„{p.raw}”</span>{' '}
                <span className="text-hint text-ink-secondary">· {n(p.rowCount)} sorban</span>
              </p>
              <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
                {opt(null, 'Kihagyom')}
                {p.suggestion ? opt('suggestion', `Erre javítom: ${p.suggestion}`) : null}
                {opt('create', `Létrehozom új gyártóként: ${p.raw}`)}
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

function ItemTable({ items, unchanged }: { items: AccessoryImportItem[]; unchanged: number }) {
  if (items.length === 0) {
    return (
      <p className="rounded-md border border-dashed border-border px-4 py-6 text-center text-body text-ink-secondary">
        {unchanged > 0 ? `Mind a ${n(unchanged)} sor megegyezik a mostani adatokkal.` : 'Nincs ilyen sor.'}
      </p>
    )
  }
  const shown = items.slice(0, TABLE_LIMIT)
  return (
    <div className="rounded-md border border-border">
      <table className="w-full text-left text-hint">
        <thead className="sticky top-0 bg-subtle">
          <tr className="border-b border-border">
            <th className="px-2 py-1.5 font-medium">Sor</th>
            <th className="px-2 py-1.5 font-medium">Termék</th>
            <th className="px-2 py-1.5 font-medium">Mi történik</th>
            <th className="px-2 py-1.5 font-medium">Mi változik</th>
            <th className="px-2 py-1.5 font-medium">Megjegyzés</th>
          </tr>
        </thead>
        <tbody>
          {shown.map((item) => {
            const status = STATUS_LABEL[item.status]
            return (
              <tr key={item.rowNumber} className="border-b border-border align-top last:border-0">
                <td className="whitespace-nowrap px-2 py-1.5 tabular-nums text-ink-secondary">{item.rowNumber}.</td>
                <td className="px-2 py-1.5 text-ink">
                  <span className="block font-medium">{item.name || item.sku}</span>
                  <span className="text-ink-secondary">
                    {item.sku}
                    {item.manufacturerName ? ` · ${item.manufacturerName}` : ''}
                  </span>
                </td>
                <td className="px-2 py-1.5">
                  <StatusBadge tone={status.tone}>{status.text}</StatusBadge>
                </td>
                <td className="px-2 py-1.5 text-ink">{item.changes.length > 0 ? item.changes.join(', ') : '—'}</td>
                <td className="px-2 py-1.5">
                  {item.issues.length > 0 ? (
                    <ul className="space-y-0.5">
                      {item.issues.map((i) => (
                        <li
                          key={`${i.where}-${i.message}`}
                          className={cn(
                            i.level === 'error' && 'text-danger-ink',
                            i.level === 'warning' && 'text-warning-ink',
                            i.level === 'info' && 'text-ink-secondary'
                          )}
                        >
                          {LEVEL_PREFIX[i.level]} · {i.where}: {i.message}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <span className="text-ink-muted">—</span>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      {items.length > TABLE_LIMIT || unchanged > 0 ? (
        <p className="border-t border-border px-2 py-1.5 text-hint text-ink-secondary">
          {items.length > TABLE_LIMIT ? `…és még ${n(items.length - TABLE_LIMIT)} sor. Szűrj fent, vagy töltsd le a hibás sorokat. ` : ''}
          {unchanged > 0 ? `${n(unchanged)} sor nem változik, azokat nem listázzuk.` : ''}
        </p>
      ) : null}
    </div>
  )
}

function ResultView({
  result,
  busy,
  onProblems,
  onClose
}: {
  result: AccessoryImportResult
  busy: string | null
  onProblems: () => void
  onClose: () => void
}) {
  const lines = [
    result.created > 0 ? `${n(result.created)} új termék készült.` : null,
    result.updated > 0 ? `${n(result.updated)} termék frissült.` : null,
    result.unchanged > 0 ? `${n(result.unchanged)} nem változott.` : null,
    result.createdManufacturers > 0 ? `${n(result.createdManufacturers)} új gyártó készült.` : null,
    result.failed.length > 0 ? `${n(result.failed.length)} sort nem sikerült menteni.` : null
  ].filter(Boolean)
  const firstFailures = result.failed.slice(0, 5)
  return (
    <>
      <DialogHeader>
        <DialogTitle>Kész</DialogTitle>
        <DialogDescription>{lines.join(' ') || 'Nem változott semmi.'}</DialogDescription>
      </DialogHeader>
      {firstFailures.length > 0 ? (
        <ul className="space-y-1 rounded-md border border-warning/30 bg-warning-soft px-3 py-2 text-hint text-warning-ink">
          {firstFailures.map((f) => (
            <li key={f.rowNumber}>
              {f.rowNumber}. sor: {f.message}
            </li>
          ))}
          {result.failed.length > firstFailures.length ? (
            <li>…és még {n(result.failed.length - firstFailures.length)}.</li>
          ) : null}
        </ul>
      ) : null}
      {result.problemCount > 0 ? (
        <p className="text-body text-ink">
          {n(result.problemCount)} sornál maradt teendő. Töltsd le őket: minden sor mellett ott a hiba oka. Javítsd, és
          töltsd fel újra ugyanitt.
        </p>
      ) : (
        <p className="text-body text-ink">Minden sor rendben.</p>
      )}
      <DialogFooter className="gap-2">
        {result.problemCount > 0 ? (
          <Button type="button" variant="secondary" loading={busy === 'problems'} onClick={onProblems}>
            Hibás sorok letöltése ({n(result.problemCount)})
          </Button>
        ) : null}
        <Button type="button" onClick={onClose}>
          Bezárás
        </Button>
      </DialogFooter>
    </>
  )
}
