'use client'

import { CircleAlert, Download, History, Info, Upload } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'

import { ConfirmDialog } from '@/components/patterns/confirm-dialog'
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
import { Select } from '@/components/ui/select'
import { createClient } from '@/lib/supabase/client'
import {
  SHOP_IMPORT_MAX_BYTES,
  SHOP_IMPORT_MAX_ROWS,
  SHOP_OPTIONAL_SHEET_META,
  SHOP_OPTIONAL_SHEETS,
  type ShopOptionalSheet
} from '@/lib/webshop/excel/columns'
import {
  matchesShopItem,
  SHOP_X_ITEM_FILTERS,
  SHOP_X_SHEET_LABEL,
  type ShopXApplyResult,
  type ShopXDecision,
  type ShopXDecisions,
  type ShopXItem,
  type ShopXItemFilter,
  type ShopXPending,
  type ShopXPreview,
  type ShopXProblem,
  type ShopXRunSummary,
  type ShopXShopOutcome,
  type ShopXSource,
  type ShopXStepResult
} from '@/lib/webshop/excel/types'
import { cn } from '@/lib/utils'

const IMPORT_BUCKET = 'tenant-imports'
const TABLE_LIMIT = 200
const RESUME_KEY = 'turinova.shop-import.run'
const STEP_RETRIES = 2

type ExportMode = 'simple' | 'full'

const DEFAULT_SHEETS: Record<ExportMode, ShopOptionalSheet[]> = {
  simple: ['specs'],
  full: ['specs', 'faq', 'related', 'documents', 'groups']
}

const ITEM_FILTER_LABEL: Record<ShopXItemFilter, string> = {
  all: 'Mind',
  update: 'Frissül',
  live: 'Kikerül a boltba',
  blocked: 'Hiányos',
  error: 'Hibás',
  unchanged: 'Nem változik'
}

const SHOP_LABEL: Record<ShopXShopOutcome, { text: string; tone: StatusBadgeTone }> = {
  goes_live: { text: 'Kikerül a boltba', tone: 'success' },
  stays_live: { text: 'Kint marad', tone: 'neutral' },
  goes_off: { text: 'Leveszed a boltból', tone: 'neutral' },
  forced_off: { text: 'Lekerül — hiányos', tone: 'warning' },
  blocked: { text: 'Nem kerül ki — hiányos', tone: 'warning' },
  off: { text: 'Nincs a boltban', tone: 'neutral' }
}

const LEVEL_PREFIX = { error: 'Hiba', warning: 'Figyelem', info: 'Infó' } as const

const PENDING_KIND_LABEL = { category: 'Kategória', attribute: 'Jellemző', value: '' } as const

/** Egy futó / félbeszakadt mentés — localStorage-ban is, hogy frissítés után folytatható legyen. */
type Job = {
  runId: string
  source: Extract<ShopXSource, { kind: 'storage' }>
  decisions: ShopXDecisions
  cursor: number
  total: number
  restore: boolean
  problems: ShopXProblem[]
  result: ShopXApplyResult
}

const hu = (n: number) => n.toLocaleString('hu-HU')

function emptyResult(runId: string, restore: boolean): ShopXApplyResult {
  return {
    runId,
    canUndo: !restore,
    updated: 0,
    wentLive: 0,
    wentOff: 0,
    createdCategories: 0,
    createdAttributes: 0,
    createdValues: 0,
    failed: 0,
    problems: [],
    notices: []
  }
}

function summary(p: ShopXPreview): string {
  const s = p.stats
  const parts = [`${hu(s.items)} termék a fájlban: ${hu(s.update)} frissül`]
  if (s.goesLive > 0) parts.push(`${hu(s.goesLive)} kikerül a boltba`)
  if (s.goesOff > 0) parts.push(`${hu(s.goesOff)} lekerül a boltról`)
  if (s.blocked > 0) parts.push(`${hu(s.blocked)}-nál hiányzik valami a boltba kerüléshez`)
  if (s.partial > 0) parts.push(`${hu(s.partial)}-nál egy-egy hibás mező kimarad`)
  if (s.error > 0) parts.push(`${hu(s.error)} sor teljesen kimarad`)
  if (s.unchanged > 0) parts.push(`${hu(s.unchanged)} nem változik`)
  return `${parts.join(', ')}.`
}

function catalogLines(p: ShopXPreview): string[] {
  const c = p.catalog
  const list = (items: string[]) => `${items.slice(0, 4).join(', ')}${items.length > 4 ? ` és még ${items.length - 4}` : ''}`
  return [
    c.attributesCreated.length > 0 ? `Új jellemző (${c.attributesCreated.length}): ${list(c.attributesCreated)}` : null,
    c.attributesUpdated.length > 0 ? `Módosuló jellemző (${c.attributesUpdated.length}): ${list(c.attributesUpdated)}` : null,
    c.valuesCreated > 0 ? `Új jellemzőérték: ${hu(c.valuesCreated)}` : null,
    c.categoriesCreated.length > 0 ? `Új kategória (${c.categoriesCreated.length}): ${list(c.categoriesCreated)}` : null,
    c.categoriesUpdated.length > 0 ? `Módosuló kategória (${c.categoriesUpdated.length}): ${list(c.categoriesUpdated)}` : null,
    c.groupsChanged.length > 0 ? `Változatcsoport beállítás (${c.groupsChanged.length}): ${list(c.groupsChanged)}` : null
  ].filter((x): x is string => Boolean(x))
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
  // Safari a letöltést aszinkron indítja: azonnali revoke → üres fájl (WebKitBlobResource error 1).
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

/** GET letöltés blob nélkül: a böngésző maga tölti le (Safari-biztos, nagy fájlnál is). */
function startDownload(url: string) {
  const a = document.createElement('a')
  a.href = url
  document.body.appendChild(a)
  a.click()
  a.remove()
}

async function errorOf(response: Response, fallback: string): Promise<string> {
  const data = (await response.json().catch(() => null)) as { error?: string } | null
  return data?.error || fallback
}

function postJson(url: string, body: unknown): Promise<Response> {
  return fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

function rowsLabel(item: ShopXItem): string {
  const first = item.rows[0]
  if (!first) return '—'
  const rest = item.rows.length - 1
  return `${SHOP_X_SHEET_LABEL[first.sheet]} ${first.rowNumber}.${rest > 0 ? ` +${rest}` : ''}`
}

function readResume(): Job | null {
  try {
    const raw = window.localStorage.getItem(RESUME_KEY)
    return raw ? (JSON.parse(raw) as Job) : null
  } catch {
    return null
  }
}

function writeResume(job: Job | null) {
  try {
    if (job) window.localStorage.setItem(RESUME_KEY, JSON.stringify({ ...job, problems: job.problems.slice(0, 2000) }))
    else window.localStorage.removeItem(RESUME_KEY)
  } catch {
    // tele a tároló — a folytatás így sem vész el, a futás a szerveren is látszik
  }
}

export function CatalogExcel({
  filter,
  filterLabel,
  q,
  count,
  canWrite
}: {
  filter: string
  filterLabel: string
  q: string
  count: number
  canWrite: boolean
}) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)

  const [exportOpen, setExportOpen] = useState(false)
  const [exportMode, setExportMode] = useState<ExportMode>('simple')
  const [exportSheets, setExportSheets] = useState<ShopOptionalSheet[]>(DEFAULT_SHEETS.simple)
  const [exportBusy, setExportBusy] = useState(false)

  const [source, setSource] = useState<Extract<ShopXSource, { kind: 'storage' }> | null>(null)
  const [preview, setPreview] = useState<ShopXPreview | null>(null)
  const [decisions, setDecisions] = useState<ShopXDecisions>({})
  const [draft, setDraft] = useState<ShopXDecisions>({})
  const [job, setJob] = useState<Job | null>(null)
  const [stalled, setStalled] = useState<string | null>(null)
  const [result, setResult] = useState<ShopXApplyResult | null>(null)
  const [busy, setBusy] = useState<null | 'upload' | 'preview' | 'apply' | 'backup' | 'problems' | 'report' | 'undo'>(null)
  const [itemFilter, setItemFilter] = useState<ShopXItemFilter>('all')
  const [resume, setResume] = useState<Job | null>(null)
  const [runsOpen, setRunsOpen] = useState(false)
  const [runs, setRuns] = useState<ShopXRunSummary[] | null>(null)
  const [undoRun, setUndoRun] = useState<{ id: string; fileName: string } | null>(null)

  const open = Boolean(preview || result || job)
  const running = busy === 'apply'

  useEffect(() => {
    setResume(readResume())
  }, [])

  useEffect(() => {
    if (!running) return
    const guard = (e: BeforeUnloadEvent) => {
      e.preventDefault()
    }
    window.addEventListener('beforeunload', guard)
    return () => window.removeEventListener('beforeunload', guard)
  }, [running])

  function changeExportMode(mode: ExportMode) {
    setExportMode(mode)
    setExportSheets(DEFAULT_SHEETS[mode])
  }

  function download(mode: ExportMode | 'template') {
    const sp = new URLSearchParams({ mode })
    if (mode !== 'template') sp.set('sheets', exportSheets.join(','))
    if (filter !== 'all') sp.set('filter', filter)
    if (q.trim()) sp.set('q', q.trim())
    setExportBusy(true)
    startDownload(`/api/webshop/catalog/export?${sp.toString()}`)
    toast.success(
      mode === 'template'
        ? 'A sablon letöltése elindult.'
        : 'A fájl készül, a letöltés pár másodperc múlva magától elindul. Töltsd ki, majd töltsd fel.'
    )
    setTimeout(() => {
      setExportBusy(false)
      setExportOpen(false)
    }, 1500)
  }

  async function requestPreview(src: Extract<ShopXSource, { kind: 'storage' }>, d: ShopXDecisions) {
    setBusy('preview')
    try {
      const response = await postJson('/api/webshop/catalog/import/preview', { source: src, decisions: d })
      if (!response.ok) {
        toast.error(await errorOf(response, 'Az előnézet nem sikerült.'))
        return false
      }
      setPreview((await response.json()) as ShopXPreview)
      setDecisions(d)
      setDraft(d)
      return true
    } catch {
      toast.error('Az előnézet nem sikerült.')
      return false
    } finally {
      setBusy(null)
    }
  }

  async function onFile(event: React.ChangeEvent<HTMLInputElement>) {
    const f = event.target.files?.[0]
    event.target.value = ''
    if (!f) return
    const lower = f.name.toLowerCase()
    if (lower.endsWith('.xls')) {
      toast.error('Ez régi .xls fájl. Nyisd meg Excelben, és mentsd el .xlsx formátumban.')
      return
    }
    if (!lower.endsWith('.xlsx') && !lower.endsWith('.csv')) {
      toast.error('Csak .xlsx vagy .csv fájl tölthető fel.')
      return
    }
    if (f.size > SHOP_IMPORT_MAX_BYTES) {
      toast.error(`A fájl túl nagy (legfeljebb ${Math.round(SHOP_IMPORT_MAX_BYTES / 1024 / 1024)} MB). Bontsd több fájlra.`)
      return
    }
    setResult(null)
    setItemFilter('all')
    setBusy('upload')
    try {
      const signed = await postJson('/api/webshop/catalog/import/upload-url', { name: f.name, size: f.size })
      if (!signed.ok) {
        toast.error(await errorOf(signed, 'A feltöltés nem indult el.'))
        return
      }
      const { path, token } = (await signed.json()) as { path: string; token: string }
      const supabase = createClient()
      if (!supabase) {
        toast.error('Az adatbázis kapcsolat nem elérhető.')
        return
      }
      const { error } = await supabase.storage.from(IMPORT_BUCKET).uploadToSignedUrl(path, token, f, {
        contentType: f.type || 'application/octet-stream'
      })
      if (error) {
        toast.error(`A feltöltés nem sikerült: ${error.message}`)
        return
      }
      const src = { kind: 'storage' as const, path, name: f.name }
      setBusy(null)
      if (await requestPreview(src, {})) setSource(src)
    } catch {
      toast.error('A feltöltés nem sikerült. Ellenőrizd a hálózatot, és próbáld újra.')
    } finally {
      setBusy((b) => (b === 'upload' ? null : b))
    }
  }

  function draftDecide(key: string, choice: ShopXDecision | null) {
    setDraft((prev) => {
      const next = { ...prev }
      if (choice) next[key] = choice
      else delete next[key]
      return next
    })
  }

  function draftAll(kind: 'create' | 'suggestion') {
    if (!preview) return
    setDraft((prev) => {
      const next = { ...prev }
      for (const p of preview.pending) {
        if (next[p.key] || p.remembered) continue
        if (kind === 'suggestion' && !p.suggestion) continue
        next[p.key] = kind
      }
      return next
    })
  }

  const draftDirty = useMemo(() => JSON.stringify(draft) !== JSON.stringify(decisions), [draft, decisions])

  const runSteps = useCallback(
    async (start: Job) => {
      let current = start
      setJob(current)
      setStalled(null)
      setBusy('apply')
      writeResume(current)
      try {
        let next: number | null = current.cursor
        while (next != null) {
          let response: Response | null = null
          let message = ''
          for (let attempt = 0; attempt <= STEP_RETRIES; attempt++) {
            try {
              response = await postJson('/api/webshop/catalog/import/step', {
                source: current.source,
                decisions: current.decisions,
                runId: current.runId,
                cursor: next
              })
              if (response.ok || response.status < 500) break
              message = await errorOf(response, 'Ez a lépés nem sikerült.')
            } catch {
              message = 'Megszakadt a kapcsolat.'
              response = null
            }
            if (attempt < STEP_RETRIES) await sleep(3000 * (attempt + 1))
          }
          if (!response || !response.ok) {
            const msg = response ? await errorOf(response, message || 'Ez a lépés nem sikerült.') : message
            setStalled(msg)
            return
          }
          const step = (await response.json()) as ShopXStepResult
          const r = current.result
          current = {
            ...current,
            cursor: step.next ?? step.total,
            total: step.total,
            problems: [...current.problems, ...step.problems],
            result: {
              ...r,
              updated: r.updated + step.updated,
              wentLive: r.wentLive + step.wentLive,
              wentOff: r.wentOff + step.wentOff,
              failed: r.failed + step.failed,
              notices: [...r.notices, ...step.notices]
            }
          }
          setJob(current)
          writeResume(current)
          next = step.next
        }
        writeResume(null)
        setResume(null)
        const final = { ...current.result, problems: current.problems }
        setResult(final)
        setJob(null)
        setPreview(null)
        toast[final.failed > 0 ? 'warning' : 'success'](
          current.restore ? 'Visszaállítva a mentés előtti állapotra.' : `${hu(final.updated)} termék frissítve.`
        )
        router.refresh()
      } finally {
        setBusy(null)
      }
    },
    [router]
  )

  async function startRun(src: Extract<ShopXSource, { kind: 'storage' }>, d: ShopXDecisions, restoresRunId: string | null) {
    setBusy('apply')
    try {
      const response = await postJson('/api/webshop/catalog/import/start', { source: src, decisions: d, restoresRunId })
      if (!response.ok) {
        toast.error(await errorOf(response, 'A mentés nem indult el.'))
        setBusy(null)
        return
      }
      const started = (await response.json()) as {
        runId: string
        total: number
        notices: string[]
        createdCategories: number
        createdAttributes: number
        createdValues: number
      }
      const restore = Boolean(restoresRunId)
      await runSteps({
        runId: started.runId,
        source: src,
        decisions: d,
        cursor: 0,
        total: started.total,
        restore,
        problems: restore ? [] : (preview?.problems ?? []),
        result: {
          ...emptyResult(started.runId, restore),
          createdCategories: started.createdCategories,
          createdAttributes: started.createdAttributes,
          createdValues: started.createdValues,
          notices: started.notices
        }
      })
    } catch {
      toast.error('A mentés nem indult el. Próbáld újra.')
      setBusy(null)
    }
  }

  async function apply() {
    if (!source || !preview || draftDirty) return
    await startRun(source, decisions, null)
  }

  async function stopRun() {
    const current = job
    if (!current) return
    await postJson('/api/webshop/catalog/import/cancel', { runId: current.runId }).catch(() => null)
    writeResume(null)
    setResume(null)
    setResult({ ...current.result, problems: current.problems, notices: [...current.result.notices, 'A mentést leállítottad — a már mentett rész megmaradt.'] })
    setJob(null)
    setStalled(null)
    setPreview(null)
    router.refresh()
  }

  async function confirmUndo() {
    if (!undoRun) return
    setBusy('undo')
    try {
      const response = await postJson('/api/webshop/catalog/import/undo', { runId: undoRun.id })
      if (!response.ok) {
        toast.error(await errorOf(response, 'A visszavonás nem indult el.'))
        setBusy(null)
        return
      }
      const { source: src } = (await response.json()) as { source: Extract<ShopXSource, { kind: 'storage' }> }
      const id = undoRun.id
      setUndoRun(null)
      setRunsOpen(false)
      setResult(null)
      await startRun(src, {}, id)
    } catch {
      toast.error('A visszavonás nem indult el.')
      setBusy(null)
    }
  }

  async function downloadWith(kind: 'backup' | 'report', url: string, fallback: string) {
    if (!source) return
    setBusy(kind)
    try {
      const response = await postJson(url, { source, decisions })
      if (!response.ok) {
        toast.error(await errorOf(response, 'A letöltés nem sikerült.'))
        return
      }
      await saveBlob(response, fallback)
    } catch {
      toast.error('A letöltés nem sikerült.')
    } finally {
      setBusy(null)
    }
  }

  async function downloadProblems() {
    const problems = result?.problems ?? preview?.problems ?? []
    if (!source || problems.length === 0) return
    setBusy('problems')
    try {
      const response = await postJson('/api/webshop/catalog/import/problems', { source, problems })
      if (!response.ok) {
        toast.error(await errorOf(response, 'A letöltés nem sikerült.'))
        return
      }
      await saveBlob(response, 'bolt_hibas_sorok.xlsx')
    } catch {
      toast.error('A letöltés nem sikerült.')
    } finally {
      setBusy(null)
    }
  }

  async function openRuns() {
    setRunsOpen(true)
    setRuns(null)
    try {
      const response = await fetch('/api/webshop/catalog/import/runs')
      const data = (await response.json().catch(() => null)) as { runs?: ShopXRunSummary[] } | null
      setRuns(data?.runs ?? [])
    } catch {
      setRuns([])
    }
  }

  function close() {
    if (running) return
    setPreview(null)
    setResult(null)
    setJob(null)
    setStalled(null)
    setSource(null)
    setDecisions({})
    setDraft({})
  }

  const visible = useMemo(() => (preview?.items ?? []).filter((i) => matchesShopItem(i, itemFilter)), [preview, itemFilter])
  const saveCount = preview ? preview.writeCount : 0
  const canSave = preview != null && (preview.writeCount > 0 || preview.catalogChangeCount > 0)

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
            loading={(busy === 'upload' || busy === 'preview') && !preview}
            onClick={() => inputRef.current?.click()}
          >
            <Upload className="size-3.5" aria-hidden />
            {busy === 'upload' ? 'Feltöltés…' : 'Feltöltöm az Excelt'}
          </Button>
          <Button type="button" variant="ghost" onClick={openRuns}>
            <History className="size-3.5" aria-hidden />
            Korábbi mentések
          </Button>
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
            className="sr-only"
            onChange={onFile}
          />
        </>
      ) : null}

      {canWrite && resume && !open ? (
        <div role="status" className="flex w-full flex-wrap items-center gap-2 rounded-md border border-warning/30 bg-warning-soft px-3 py-2 text-hint text-warning-ink">
          <CircleAlert className="size-3.5 shrink-0" aria-hidden />
          <span>
            Félbeszakadt mentés: „{resume.source.name}” — {hu(resume.cursor)} / {hu(resume.total)} termék kész.
          </span>
          <Button type="button" size="sm" variant="secondary" onClick={() => runSteps(resume)}>
            Folytatom
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => {
              void postJson('/api/webshop/catalog/import/cancel', { runId: resume.runId }).catch(() => null)
              writeResume(null)
              setResume(null)
            }}
          >
            Lezárom így
          </Button>
        </div>
      ) : null}

      <Dialog open={exportOpen} onOpenChange={(o) => !exportBusy && setExportOpen(o)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Bolt adatok letöltése</DialogTitle>
            <DialogDescription>
              A mostani szűrés: {filterLabel}
              {q.trim() ? ` · „${q.trim()}”` : ''} — {hu(count)} termék.
            </DialogDescription>
          </DialogHeader>
          <fieldset className="space-y-2">
            <legend className="mb-1 text-body font-medium text-ink">Mennyi oszlop legyen a Bolt lapon?</legend>
            {(
              [
                ['simple', 'Egyszerű', 'A legfontosabbak: kategória, leírás, mire jó, márka, változatcsoport, csomag súlya.'],
                ['full', 'Teljes', 'Minden bolt mező (kiszerelés, méretek, összetevők, videó, webcím…).']
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
                  name="shop-export-mode"
                  className="mt-0.5 size-4 accent-primary"
                  checked={exportMode === value}
                  onChange={() => changeExportMode(value)}
                />
                <span>
                  <span className="block text-body font-medium text-ink">{label}</span>
                  <span className="block text-hint text-ink-secondary">{hint}</span>
                </span>
              </label>
            ))}
          </fieldset>
          <fieldset>
            <legend className="mb-1 text-body font-medium text-ink">Milyen lapok legyenek benne?</legend>
            <div className="grid gap-1 sm:grid-cols-2">
              {SHOP_OPTIONAL_SHEETS.map((sheet) => (
                <label key={sheet} className="flex cursor-pointer gap-2 rounded-md px-1 py-1 hover:bg-subtle">
                  <input
                    type="checkbox"
                    className="mt-0.5 size-4 accent-primary"
                    checked={exportSheets.includes(sheet)}
                    onChange={(e) =>
                      setExportSheets((prev) => (e.target.checked ? [...prev, sheet] : prev.filter((s) => s !== sheet)))
                    }
                  />
                  <span>
                    <span className="block text-body text-ink">{SHOP_OPTIONAL_SHEET_META[sheet].label}</span>
                    <span className="block text-hint text-ink-secondary">{SHOP_OPTIONAL_SHEET_META[sheet].hint}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
          {count > SHOP_IMPORT_MAX_ROWS ? (
            <p className="flex gap-1.5 rounded-md border border-warning/30 bg-warning-soft px-3 py-2 text-hint text-warning-ink">
              <CircleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
              Egy fájlban legfeljebb {hu(SHOP_IMPORT_MAX_ROWS)} termék tölthető vissza. Szűrj a letöltés előtt (pl.
              kategóriára).
            </p>
          ) : null}
          <DialogFooter className="flex-wrap gap-2 sm:justify-between">
            <Button type="button" variant="ghost" disabled={exportBusy} onClick={() => download('template')}>
              Üres sablon
            </Button>
            <div className="flex gap-2">
              <Button type="button" variant="secondary" disabled={exportBusy} onClick={() => setExportOpen(false)}>
                Mégse
              </Button>
              <Button type="button" loading={exportBusy} disabled={count === 0} onClick={() => download(exportMode)}>
                Letöltöm ({hu(count)} termék)
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={open} onOpenChange={(o) => !o && close()}>
        <DialogContent className="flex max-h-[92vh] max-w-5xl flex-col">
          {job ? (
            <ProgressView job={job} stalled={stalled} running={running} onResume={() => runSteps(job)} onStop={stopRun} />
          ) : result ? (
            <ResultView
              result={result}
              busy={busy}
              canDownloadProblems={Boolean(source)}
              onProblems={downloadProblems}
              onUndo={
                result.canUndo && result.runId && result.updated > 0
                  ? () => setUndoRun({ id: result.runId!, fileName: source?.name ?? '' })
                  : null
              }
              onClose={close}
            />
          ) : preview ? (
            <>
              <DialogHeader>
                <DialogTitle>{preview.snapshot ? 'Visszaállítás — mi fog történni?' : 'Mi fog történni?'}</DialogTitle>
                <DialogDescription>Még semmi nincs elmentve. Nézd át, döntsd el a kérdéseket, majd mentsd.</DialogDescription>
              </DialogHeader>

              <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1" aria-busy={busy === 'preview'}>
                <p className="text-body text-ink">{summary(preview)}</p>

                {catalogLines(preview).length > 0 ? (
                  <ul className="space-y-0.5 rounded-md border border-border px-3 py-2 text-hint text-ink">
                    {catalogLines(preview).map((l) => (
                      <li key={l}>{l}</li>
                    ))}
                  </ul>
                ) : null}

                {preview.notices.length > 0 ? (
                  <ul className="space-y-1 rounded-md border border-border bg-subtle px-3 py-2 text-hint text-ink-secondary">
                    {preview.notices.map((n) => (
                      <li key={n} className="flex gap-1.5">
                        <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                        {n}
                      </li>
                    ))}
                  </ul>
                ) : null}

                {preview.pending.length > 0 ? (
                  <PendingList
                    pending={preview.pending}
                    draft={draft}
                    dirty={draftDirty}
                    disabled={busy !== null}
                    onDecide={draftDecide}
                    onAll={draftAll}
                    onApply={() => source && requestPreview(source, draft)}
                    applying={busy === 'preview'}
                  />
                ) : null}

                {preview.groups.length > 0 ? <GroupList groups={preview.groups} /> : null}

                <nav className="flex flex-wrap gap-1.5" aria-label="Sorok szűrése">
                  {SHOP_X_ITEM_FILTERS.map((f) => (
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
                      <span className="tabular-nums opacity-80">{hu(preview.itemCounts[f])}</span>
                    </button>
                  ))}
                </nav>

                <ItemTable items={visible} total={preview.itemCounts[itemFilter]} />
              </div>

              <DialogFooter className="flex-wrap gap-2 sm:justify-between">
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    loading={busy === 'backup'}
                    disabled={busy !== null || preview.writeCount === 0}
                    onClick={() =>
                      downloadWith('backup', '/api/webshop/catalog/import/backup', 'bolt_mentes_elotti_allapot.xlsx')
                    }
                  >
                    Jelenlegi állapot letöltése
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    loading={busy === 'report'}
                    disabled={busy !== null}
                    onClick={() => downloadWith('report', '/api/webshop/catalog/import/report', 'bolt_import_jelentes.xlsx')}
                  >
                    Teljes jelentés
                  </Button>
                  {preview.problems.length > 0 ? (
                    <Button type="button" variant="ghost" loading={busy === 'problems'} disabled={busy !== null} onClick={downloadProblems}>
                      Hibás sorok letöltése ({hu(preview.problems.length)})
                    </Button>
                  ) : null}
                </div>
                <div className="flex items-center gap-2">
                  {draftDirty ? <span className="text-hint text-warning-ink">Előbb ellenőrizd a döntéseket.</span> : null}
                  <Button type="button" variant="secondary" disabled={running} onClick={close}>
                    Mégse
                  </Button>
                  <Button type="button" loading={running} disabled={busy !== null || !canSave || draftDirty} onClick={apply}>
                    {saveCount > 0
                      ? `${hu(saveCount)} termék mentése`
                      : preview.catalogChangeCount > 0
                        ? 'Katalógus mentése'
                        : 'Nincs mit menteni'}
                  </Button>
                </div>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={runsOpen} onOpenChange={(o) => !busy && setRunsOpen(o)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Korábbi mentések</DialogTitle>
            <DialogDescription>
              Az Excel importok a mentés előtti állapotukkal együtt. A visszavonás a mentés előtti adatokat állítja vissza
              ezeknél a termékeknél (a közben létrehozott kategóriák és jellemzők megmaradnak).
            </DialogDescription>
          </DialogHeader>
          {runs == null ? (
            <p className="text-body text-ink-secondary">Betöltés…</p>
          ) : runs.length === 0 ? (
            <p className="text-body text-ink-secondary">Még nem volt Excel mentés.</p>
          ) : (
            <table className="w-full text-left text-hint">
              <thead>
                <tr className="border-b border-border text-ink-secondary">
                  <th className="py-1.5 pr-2 font-medium">Mikor</th>
                  <th className="py-1.5 pr-2 font-medium">Fájl</th>
                  <th className="py-1.5 pr-2 font-medium">Termék</th>
                  <th className="py-1.5 pr-2 font-medium">Állapot</th>
                  <th className="py-1.5 font-medium">
                    <span className="sr-only">Művelet</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {runs.map((r) => (
                  <tr key={r.id} className="border-b border-border last:border-0">
                    <td className="whitespace-nowrap py-1.5 pr-2 tabular-nums text-ink-secondary">
                      {new Date(r.createdAt).toLocaleString('hu-HU', { dateStyle: 'short', timeStyle: 'short' })}
                    </td>
                    <td className="py-1.5 pr-2 text-ink">{r.fileName}</td>
                    <td className="py-1.5 pr-2 tabular-nums text-ink">{hu(r.updated)}</td>
                    <td className="py-1.5 pr-2">
                      <StatusBadge tone={r.status === 'done' ? 'success' : r.status === 'failed' ? 'warning' : 'neutral'}>
                        {r.kind === 'restore'
                          ? 'Visszaállítás'
                          : { running: 'Fut', done: 'Kész', failed: 'Félbeszakadt', undone: 'Visszavonva' }[r.status]}
                      </StatusBadge>
                    </td>
                    <td className="py-1.5 text-right">
                      {r.canUndo ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          disabled={busy !== null}
                          onClick={() => setUndoRun({ id: r.id, fileName: r.fileName })}
                        >
                          Visszavonom
                        </Button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => setRunsOpen(false)}>
              Bezárás
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={undoRun != null}
        onOpenChange={(o) => !o && busy !== 'undo' && setUndoRun(null)}
        title="Visszavonod ezt a mentést?"
        description={`A(z) „${undoRun?.fileName ?? ''}” által módosított termékek visszakapják a mentés előtti bolt adataikat (leírás, jellemzők, kapcsolatok, dokumentumok, bolt állapot). Ami azóta máshol változott rajtuk, az is visszaáll.`}
        confirmLabel="Visszavonom"
        variant="danger"
        loading={busy === 'undo'}
        onConfirm={confirmUndo}
      />
    </>
  )
}

function ProgressView({
  job,
  stalled,
  running,
  onResume,
  onStop
}: {
  job: Job
  stalled: string | null
  running: boolean
  onResume: () => void
  onStop: () => void
}) {
  const pct = job.total > 0 ? Math.round((job.cursor / job.total) * 100) : 0
  return (
    <>
      <DialogHeader>
        <DialogTitle>{job.restore ? 'Visszaállítás…' : 'Mentés…'}</DialogTitle>
        <DialogDescription>
          {stalled
            ? 'A mentés megállt. A már mentett rész megmaradt.'
            : 'Kötegenként mentünk. Ne zárd be az oldalt — ha mégis megszakad, innen folytatható.'}
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-2">
        <div
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={job.total}
          aria-valuenow={job.cursor}
          aria-label="Mentés állapota"
          className="h-2 w-full overflow-hidden rounded-full bg-subtle"
        >
          <div className="h-full bg-primary transition-[width] duration-300" style={{ width: `${pct}%` }} />
        </div>
        <p role="status" className="text-body tabular-nums text-ink">
          {hu(job.cursor)} / {hu(job.total)} termék feldolgozva ({pct}%) · {hu(job.result.updated)} mentve
          {job.result.failed > 0 ? ` · ${hu(job.result.failed)} nem sikerült` : ''}
        </p>
        {stalled ? (
          <p className="flex gap-1.5 rounded-md border border-warning/30 bg-warning-soft px-3 py-2 text-hint text-warning-ink">
            <CircleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            {stalled}
          </p>
        ) : null}
      </div>
      {stalled ? (
        <DialogFooter className="gap-2">
          <Button type="button" variant="secondary" onClick={onStop}>
            Leállítom itt
          </Button>
          <Button type="button" loading={running} onClick={onResume}>
            Folytatom
          </Button>
        </DialogFooter>
      ) : null}
    </>
  )
}

function PendingList({
  pending,
  draft,
  dirty,
  disabled,
  applying,
  onDecide,
  onAll,
  onApply
}: {
  pending: ShopXPending[]
  draft: ShopXDecisions
  dirty: boolean
  disabled: boolean
  applying: boolean
  onDecide: (key: string, choice: ShopXDecision | null) => void
  onAll: (kind: 'create' | 'suggestion') => void
  onApply: () => void
}) {
  const open = pending.filter((p) => !draft[p.key] && !p.remembered).length
  return (
    <section className="rounded-md border border-warning/30 bg-warning-soft px-3 py-2" aria-label="Döntés kell">
      <h3 className="mb-1 flex items-center gap-1.5 text-body font-medium text-warning-ink">
        <CircleAlert className="size-3.5 shrink-0" aria-hidden />
        Döntés kell ({pending.length}) — ezek nem léteznek még{open > 0 ? `, ${open} még nyitott` : ''}
      </h3>
      <p className="mb-2 text-hint text-warning-ink">
        Magunktól semmit nem hozunk létre. Ha kihagyod, az a mező nem változik, a sor többi adata mentődik. A választást
        megjegyezzük: legközelebb ugyanarra a névre nem kérdezünk.
      </p>
      <div className="mb-2 flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="secondary" disabled={disabled} onClick={() => onAll('suggestion')}>
          Ahol van javaslat, azt választom
        </Button>
        <Button type="button" size="sm" variant="secondary" disabled={disabled} onClick={() => onAll('create')}>
          A többit létrehozom
        </Button>
        {dirty ? (
          <Button type="button" size="sm" variant="secondary" loading={applying} disabled={disabled} onClick={onApply}>
            Döntések ellenőrzése
          </Button>
        ) : null}
      </div>
      <ul className="max-h-72 space-y-1.5 overflow-y-auto">
        {pending.map((p) => {
          const value = draft[p.key] ?? (p.remembered ? (p.choice ?? '') : '')
          const kindLabel = p.kind === 'value' ? p.attributeName : PENDING_KIND_LABEL[p.kind]
          return (
            <li key={p.key} className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md border border-border bg-surface px-2.5 py-1.5">
              <p className="min-w-0 flex-1 text-body text-ink">
                <span className="text-ink-secondary">{kindLabel}:</span> <span className="font-medium">„{p.raw}”</span>{' '}
                <span className="text-hint text-ink-secondary">
                  · {p.rowCount} sorban{p.remembered ? ' · megjegyzett párosítás' : ''}
                </span>
              </p>
              <label className="sr-only" htmlFor={`pending-${p.key}`}>
                Mi legyen vele: {p.raw}
              </label>
              <Select
                id={`pending-${p.key}`}
                className="w-auto min-w-64 max-w-md"
                value={value}
                disabled={disabled}
                onChange={(e) => onDecide(p.key, (e.target.value || null) as ShopXDecision | null)}
              >
                <option value="">Kihagyom (nem változik)</option>
                {p.suggestion ? <option value="suggestion">Erre javítom: {p.suggestion}</option> : null}
                {p.candidates.map((c) => (
                  <option key={c.id} value={`use:${c.id}`}>
                    Ezt használom: {c.label}
                  </option>
                ))}
                <option value="create">Létrehozom újként: {p.createLabel}</option>
              </Select>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

function GroupList({ groups }: { groups: ShopXPreview['groups'] }) {
  const withIssues = groups.filter((g) => g.issues.length > 0).length
  return (
    <details className="rounded-md border border-border px-3 py-2" open={withIssues > 0}>
      <summary className="cursor-pointer text-body font-medium text-ink">
        Változatcsoportok ({groups.length}){withIssues > 0 ? ` — ${withIssues}-nál figyelni kell` : ''}
      </summary>
      <ul className="mt-2 space-y-2">
        {groups.map((g) => (
          <li key={g.code} className="rounded-md border border-border bg-surface px-2.5 py-2">
            <p className="text-body text-ink">
              <span className="font-medium">{g.code}</span>
              {g.title ? <span> · {g.title}</span> : null}
              <span className="text-ink-secondary">
                {' '}
                · {g.members.length} termék
                {g.axes.length > 0 ? ` · a vásárló ezek közül választ: ${g.axes.join(', ')}` : ''}
              </span>
            </p>
            {g.axes.length > 0 ? (
              <table className="mt-1 w-full text-left text-hint">
                <thead>
                  <tr className="text-ink-secondary">
                    <th className="py-0.5 pr-2 font-medium">SKU</th>
                    {g.axes.map((a) => (
                      <th key={a} className="py-0.5 pr-2 font-medium">
                        {a}
                      </th>
                    ))}
                    <th className="py-0.5 font-medium">Bolt</th>
                  </tr>
                </thead>
                <tbody>
                  {g.members.map((m) => (
                    <tr key={m.sku}>
                      <td className="py-0.5 pr-2 tabular-nums text-ink">
                        {m.sku}
                        {m.main ? <span className="ml-1 text-ink-secondary">(fő termék)</span> : null}
                      </td>
                      {g.axes.map((a) => (
                        <td key={a} className="py-0.5 pr-2 text-ink">
                          {m.values[a]}
                        </td>
                      ))}
                      <td className="py-0.5 text-ink-secondary">{m.live ? 'kint' : 'nincs kint'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : null}
            {g.issues.length > 0 ? (
              <ul className="mt-1 space-y-0.5 text-hint text-warning-ink">
                {g.issues.map((i) => (
                  <li key={i}>Figyelem: {i}</li>
                ))}
              </ul>
            ) : null}
          </li>
        ))}
      </ul>
    </details>
  )
}

function ItemTable({ items, total }: { items: ShopXItem[]; total: number }) {
  if (items.length === 0) {
    return (
      <p className="rounded-md border border-dashed border-border px-4 py-6 text-center text-body text-ink-secondary">
        Nincs ilyen sor.
      </p>
    )
  }
  const shown = items.slice(0, TABLE_LIMIT)
  const hidden = total - shown.length
  return (
    <div className="rounded-md border border-border">
      <table className="w-full text-left text-hint">
        <thead className="sticky top-0 bg-subtle">
          <tr className="border-b border-border">
            <th className="px-2 py-1.5 font-medium">Sor</th>
            <th className="px-2 py-1.5 font-medium">Termék</th>
            <th className="px-2 py-1.5 font-medium">Mi változik</th>
            <th className="px-2 py-1.5 font-medium">Bolt</th>
            <th className="px-2 py-1.5 font-medium">Megjegyzés</th>
          </tr>
        </thead>
        <tbody>
          {shown.map((item) => {
            const shop = SHOP_LABEL[item.shop]
            return (
              <tr key={item.key} className="border-b border-border align-top last:border-0">
                <td className="whitespace-nowrap px-2 py-1.5 tabular-nums text-ink-secondary">{rowsLabel(item)}</td>
                <td className="px-2 py-1.5 text-ink">
                  <span className="block font-medium">{item.name || item.sku || '—'}</span>
                  {item.name && item.sku ? <span className="text-ink-secondary">{item.sku}</span> : null}
                </td>
                <td className="px-2 py-1.5 text-ink">
                  {item.status === 'error' && item.changes.length === 0
                    ? 'Kimarad'
                    : item.changes.length > 0
                      ? item.changes.join(', ')
                      : 'Nem változik'}
                </td>
                <td className="px-2 py-1.5">
                  {item.accessoryId ? <StatusBadge tone={shop.tone}>{shop.text}</StatusBadge> : '—'}
                </td>
                <td className="px-2 py-1.5">
                  <ul className="space-y-0.5">
                    {item.shopReasons.map((r) => (
                      <li key={r} className="text-warning-ink">
                        Hiányzik: {r}
                      </li>
                    ))}
                    {item.issues.slice(0, 12).map((i) => (
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
                    {item.issues.length > 12 ? (
                      <li className="text-ink-secondary">…és még {item.issues.length - 12} megjegyzés (Teljes jelentés).</li>
                    ) : null}
                    {item.shopReasons.length === 0 && item.issues.length === 0 ? <li className="text-ink-muted">—</li> : null}
                  </ul>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      {hidden > 0 ? (
        <p className="border-t border-border px-2 py-1.5 text-hint text-ink-secondary">
          …és még {hu(hidden)} sor. A teljes listát a „Teljes jelentés” gombbal töltheted le.
        </p>
      ) : null}
    </div>
  )
}

function ResultView({
  result,
  busy,
  canDownloadProblems,
  onProblems,
  onUndo,
  onClose
}: {
  result: ShopXApplyResult
  busy: string | null
  canDownloadProblems: boolean
  onProblems: () => void
  onUndo: (() => void) | null
  onClose: () => void
}) {
  const lines = [
    `${hu(result.updated)} termék frissült.`,
    result.wentLive > 0 ? `${hu(result.wentLive)} kikerült a boltba.` : null,
    result.wentOff > 0 ? `${hu(result.wentOff)} lekerült a boltról.` : null,
    result.createdCategories > 0 ? `${hu(result.createdCategories)} új kategória készült.` : null,
    result.createdAttributes > 0 ? `${hu(result.createdAttributes)} új jellemző készült.` : null,
    result.createdValues > 0 ? `${hu(result.createdValues)} új jellemzőérték készült.` : null,
    result.failed > 0 ? `${hu(result.failed)} terméket nem sikerült menteni.` : null
  ].filter(Boolean)
  return (
    <>
      <DialogHeader>
        <DialogTitle>Kész</DialogTitle>
        <DialogDescription>{lines.join(' ')}</DialogDescription>
      </DialogHeader>
      {result.notices.length > 0 ? (
        <ul className="space-y-1 rounded-md border border-warning/30 bg-warning-soft px-3 py-2 text-hint text-warning-ink">
          {result.notices.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      ) : null}
      {result.problems.length > 0 ? (
        <p className="text-body text-ink">
          {hu(result.problems.length)} sornál maradt teendő. Töltsd le őket: minden sor mellett ott a hiba oka. Javítsd, és
          töltsd fel újra ugyanitt.
        </p>
      ) : (
        <p className="text-body text-ink">Minden sor rendben.</p>
      )}
      {onUndo ? (
        <p className="text-hint text-ink-secondary">
          Ha valami nem úgy lett, ahogy szeretted volna, a mentés előtti állapot visszaállítható — most vagy később a
          „Korábbi mentések” alatt.
        </p>
      ) : null}
      <DialogFooter className="flex-wrap gap-2 sm:justify-between">
        <div className="flex gap-2">
          {onUndo ? (
            <Button type="button" variant="ghost" disabled={busy !== null} onClick={onUndo}>
              Visszavonom a mentést
            </Button>
          ) : null}
        </div>
        <div className="flex gap-2">
          {result.problems.length > 0 && canDownloadProblems ? (
            <Button type="button" variant="secondary" loading={busy === 'problems'} onClick={onProblems}>
              Hibás sorok letöltése ({hu(result.problems.length)})
            </Button>
          ) : null}
          <Button type="button" onClick={onClose}>
            Bezárás
          </Button>
        </div>
      </DialogFooter>
    </>
  )
}
