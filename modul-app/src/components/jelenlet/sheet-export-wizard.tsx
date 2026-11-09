'use client'

import { AlertTriangle, Check, FileDown, Trash2, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { toast } from 'sonner'

import { ConfirmDialog } from '@/components/patterns/confirm-dialog'
import { FormField } from '@/components/patterns/form-field'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { MenuSelect } from '@/components/ui/menu-select'
import { Switch } from '@/components/ui/switch'
import {
  deleteSheetPresetAction,
  loadSheetWizardDataAction,
  saveSheetPresetAction,
  type SheetWizardData
} from '@/lib/jelenlet/sheet-preset-actions'
import {
  builtinPresetOptions,
  describeSheetRules,
  type SheetPresetOption,
  type SheetRules
} from '@/lib/jelenlet/sheet-rules'
import { cn } from '@/lib/utils'

import type { SheetPreviewResponse } from '@/app/api/jelenlet/iv/preview/route'

const MONTH_NAMES = [
  'Január',
  'Február',
  'Március',
  'Április',
  'Május',
  'Június',
  'Július',
  'Augusztus',
  'Szeptember',
  'Október',
  'November',
  'December'
]

const STEPS = ['Kik és mikor', 'Sablon', 'Szabályok', 'Előnézet'] as const

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  employees: { id: string; name: string }[]
  onRemoveEmployee: (id: string) => void
  year: number
  month: number
}

function hours(min: number) {
  return (min / 60).toFixed(2).replace('.', ',')
}

function sameRules(a: SheetRules, b: SheetRules) {
  return JSON.stringify(a) === JSON.stringify(b)
}

function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
  hint
}: {
  label: string
  value: T
  options: { value: T; label: string }[]
  onChange: (v: T) => void
  hint?: string
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-label text-ink">{label}</span>
      <div
        role="radiogroup"
        aria-label={label}
        className="inline-flex w-fit flex-wrap gap-0.5 rounded-md border border-border bg-subtle p-0.5"
      >
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={value === o.value}
            onClick={() => onChange(o.value)}
            className={cn(
              'inline-flex h-7 items-center rounded-[5px] px-2.5 text-[13px] font-medium transition-colors',
              value === o.value
                ? 'bg-ink text-white'
                : 'text-ink-secondary hover:bg-surface hover:text-ink'
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
      {hint ? <p className="text-hint text-ink-secondary">{hint}</p> : null}
    </div>
  )
}

function RuleGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3 rounded-md border border-border bg-surface p-3">
      <h3 className="text-[13px] font-semibold text-ink">{title}</h3>
      {children}
    </section>
  )
}

export function SheetExportWizard({
  open,
  onOpenChange,
  employees,
  onRemoveEmployee,
  year: initialYear,
  month: initialMonth
}: Props) {
  const [step, setStep] = useState(0)
  const [year, setYear] = useState(String(initialYear))
  const [month, setMonth] = useState(String(initialMonth))
  const [data, setData] = useState<SheetWizardData | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [presetId, setPresetId] = useState<string>('builtin:official')
  const [rules, setRules] = useState<SheetRules | null>(null)
  const [output, setOutput] = useState<'zip' | 'merged'>('zip')
  const [preview, setPreview] = useState<SheetPreviewResponse | null>(null)
  const [previewError, setPreviewError] = useState<string | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewEmployeeId, setPreviewEmployeeId] = useState<string | null>(null)
  const [saveName, setSaveName] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<SheetPresetOption | null>(null)
  const [pending, startTransition] = useTransition()
  const [downloading, setDownloading] = useState(false)
  const previewSeq = useRef(0)

  const presets = useMemo<SheetPresetOption[]>(() => {
    const builtins = builtinPresetOptions().map((p) =>
      p.rules.base === 'official' && data
        ? { ...p, rules: { ...p.rules, rotationTypeIds: data.defaultRotationTypeIds } }
        : p
    )
    return [...builtins, ...(data?.presets ?? [])]
  }, [data])

  const selectedPreset = presets.find((p) => p.id === presetId) ?? presets[0]!
  const dirty = rules ? !sameRules(rules, selectedPreset.rules) : false
  const presetName = dirty ? `${selectedPreset.name} (módosítva)` : selectedPreset.name

  useEffect(() => {
    if (!open) return
    setStep(0)
    setYear(String(initialYear))
    setMonth(String(initialMonth))
    setPreview(null)
    setPreviewEmployeeId(null)
    if (data) return
    let cancelled = false
    void loadSheetWizardDataAction().then((res) => {
      if (cancelled) return
      if (!res.ok) setLoadError(res.message)
      else setData(res.data)
    })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  function pickPreset(p: SheetPresetOption) {
    setPresetId(p.id)
    setRules({ ...p.rules, rotationTypeIds: [...p.rules.rotationTypeIds] })
  }

  function patch(next: Partial<SheetRules>) {
    setRules((prev) => (prev ? { ...prev, ...next } : prev))
  }

  const requestBody = (extra?: { previewEmployeeId?: string | null }) => ({
    employeeIds: employees.map((e) => e.id),
    year: Number(year),
    month: Number(month),
    rules: rules ?? selectedPreset.rules,
    presetName,
    output,
    previewEmployeeId: extra?.previewEmployeeId ?? null
  })

  async function loadPreview(targetId: string | null) {
    const seq = ++previewSeq.current
    setPreviewLoading(true)
    setPreviewError(null)
    try {
      const res = await fetch('/api/jelenlet/iv/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody({ previewEmployeeId: targetId }))
      })
      const json = (await res.json().catch(() => null)) as
        | (SheetPreviewResponse & { error?: string })
        | null
      if (seq !== previewSeq.current) return
      if (!res.ok || !json) throw new Error(json?.error || 'Előnézet sikertelen.')
      setPreview(json)
    } catch (e) {
      if (seq === previewSeq.current) {
        setPreviewError(e instanceof Error ? e.message : 'Előnézet sikertelen.')
      }
    } finally {
      if (seq === previewSeq.current) setPreviewLoading(false)
    }
  }

  function goTo(next: number) {
    if (next === 2 && !rules) pickPreset(selectedPreset)
    if (next === 3) {
      const target = previewEmployeeId ?? employees[0]?.id ?? null
      setPreviewEmployeeId(target)
      void loadPreview(target)
    }
    setStep(next)
  }

  async function download() {
    setDownloading(true)
    try {
      const res = await fetch('/api/jelenlet/iv/pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody())
      })
      if (!res.ok) {
        const json = (await res.json().catch(() => null)) as { error?: string } | null
        throw new Error(json?.error || 'PDF generálás sikertelen.')
      }
      const blob = await res.blob()
      const cd = res.headers.get('Content-Disposition') || ''
      const match = /filename\*=UTF-8''([^;]+)|filename="([^"]+)"/.exec(cd)
      const filename = decodeURIComponent(match?.[1] || match?.[2] || 'jelenleti-iv.pdf')
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
      toast.success(
        employees.length === 1
          ? 'Jelenléti ív letöltve.'
          : `Jelenléti ívek letöltve (${employees.length} dolgozó).`
      )
      onOpenChange(false)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'PDF generálás sikertelen.')
    } finally {
      setDownloading(false)
    }
  }

  function savePreset(overwrite: boolean) {
    if (!rules) return
    const name = overwrite ? selectedPreset.name : saveName.trim()
    if (!name) {
      toast.error('Add meg a sablon nevét.')
      return
    }
    startTransition(async () => {
      const res = await saveSheetPresetAction({
        id: overwrite && !selectedPreset.builtin ? selectedPreset.id : null,
        name,
        rules
      })
      if (!res.ok) {
        toast.error(res.message)
        return
      }
      setData((prev) =>
        prev
          ? {
              ...prev,
              presets: [
                ...prev.presets.filter((p) => p.id !== res.preset.id),
                res.preset
              ].sort((a, b) => a.name.localeCompare(b.name, 'hu'))
            }
          : prev
      )
      setPresetId(res.preset.id)
      setRules(res.preset.rules)
      setSaveName('')
      toast.success(overwrite ? 'Sablon frissítve.' : 'Sablon mentve.')
    })
  }

  function confirmDeletePreset() {
    if (!deleteTarget) return
    const target = deleteTarget
    startTransition(async () => {
      const res = await deleteSheetPresetAction({ id: target.id })
      if (!res.ok) {
        toast.error(res.message)
        return
      }
      setData((prev) =>
        prev ? { ...prev, presets: prev.presets.filter((p) => p.id !== target.id) } : prev
      )
      if (presetId === target.id) pickPreset(presets[0]!)
      setDeleteTarget(null)
      toast.success('Sablon törölve.')
    })
  }

  const yearOptions = useMemo(() => {
    const y = new Date().getFullYear()
    return [y - 1, y, y + 1].map((v) => ({ value: String(v), label: String(v) }))
  }, [])

  const busy = downloading || pending
  const r = rules ?? selectedPreset.rules
  const totalWarnings = preview?.employees.reduce((s, e) => s + e.warnings.length, 0) ?? 0
  const previewTarget = preview?.employees.find((e) => e.id === previewEmployeeId) ?? null

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!busy) onOpenChange(next)
        }}
      >
        <DialogContent className="flex max-h-[90dvh] max-w-5xl flex-col gap-3 overflow-hidden">
          <DialogHeader>
            <DialogTitle>Jelenléti ív exportálása</DialogTitle>
            <DialogDescription>
              {employees.length} dolgozó · {year}. {MONTH_NAMES[Number(month) - 1]} ·{' '}
              {presetName}
            </DialogDescription>
          </DialogHeader>

          <ol className="flex flex-wrap items-center gap-1.5" aria-label="Lépések">
            {STEPS.map((label, i) => (
              <li key={label} className="flex items-center gap-1.5">
                <span
                  className={cn(
                    'inline-flex h-7 items-center gap-1.5 rounded-md px-2.5 text-[13px] font-medium',
                    i === step
                      ? 'bg-ink text-white'
                      : i < step
                        ? 'bg-subtle text-ink'
                        : 'text-ink-muted'
                  )}
                  aria-current={i === step ? 'step' : undefined}
                >
                  {i < step ? (
                    <Check className="size-3.5" aria-hidden />
                  ) : (
                    <span className="tabular-nums">{i + 1}.</span>
                  )}
                  {label}
                </span>
                {i < STEPS.length - 1 ? (
                  <span className="text-ink-muted" aria-hidden>
                    ›
                  </span>
                ) : null}
              </li>
            ))}
          </ol>

          <div className="min-h-0 flex-1 overflow-y-auto pr-1">
            {loadError ? (
              <p
                role="alert"
                className="rounded-md border border-danger/30 bg-danger-soft p-3 text-body text-danger-ink"
              >
                {loadError}
              </p>
            ) : null}

            {step === 0 ? (
              <div className="space-y-4">
                <div className="grid max-w-md grid-cols-2 gap-3">
                  <FormField label="Év" htmlFor="sheet-year">
                    <MenuSelect
                      id="sheet-year"
                      value={year}
                      options={yearOptions}
                      allowEmpty={false}
                      onChange={setYear}
                    />
                  </FormField>
                  <FormField label="Hónap" htmlFor="sheet-month">
                    <MenuSelect
                      id="sheet-month"
                      value={month}
                      options={MONTH_NAMES.map((label, i) => ({
                        value: String(i + 1),
                        label
                      }))}
                      allowEmpty={false}
                      onChange={setMonth}
                    />
                  </FormField>
                </div>
                <div>
                  <p className="mb-1.5 text-label text-ink">
                    Kijelölt dolgozók ({employees.length})
                  </p>
                  <ul className="flex flex-wrap gap-1.5">
                    {employees.map((e) => (
                      <li
                        key={e.id}
                        className="inline-flex h-7 items-center gap-1 rounded-md border border-border bg-surface pl-2.5 pr-1 text-[13px] text-ink"
                      >
                        {e.name}
                        <button
                          type="button"
                          className="inline-flex size-5 items-center justify-center rounded text-ink-muted hover:bg-subtle hover:text-ink"
                          onClick={() => onRemoveEmployee(e.id)}
                          aria-label={`${e.name} eltávolítása`}
                          disabled={employees.length <= 1}
                        >
                          <X className="size-3.5" aria-hidden />
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ) : null}

            {step === 1 ? (
              <ul className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Sablon">
                {presets.map((p) => {
                  const active = p.id === presetId
                  return (
                    <li key={p.id}>
                      <div
                        className={cn(
                          'flex h-full flex-col gap-2 rounded-md border p-3',
                          active ? 'border-ink ring-1 ring-ink' : 'border-border'
                        )}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <button
                            type="button"
                            role="radio"
                            aria-checked={active}
                            onClick={() => pickPreset(p)}
                            className="flex items-center gap-2 text-left"
                          >
                            <span
                              className={cn(
                                'flex size-4 items-center justify-center rounded-full border',
                                active ? 'border-ink bg-ink' : 'border-border'
                              )}
                              aria-hidden
                            >
                              {active ? <span className="size-1.5 rounded-full bg-white" /> : null}
                            </span>
                            <span className="text-[14px] font-semibold text-ink">{p.name}</span>
                            <span className="rounded bg-subtle px-1.5 py-0.5 text-[11px] font-medium text-ink-secondary">
                              {p.builtin ? 'Beépített' : 'Mentett'} ·{' '}
                              {p.rules.base === 'official' ? 'hivatalos' : 'belső'}
                            </span>
                          </button>
                          {!p.builtin && data?.canWrite ? (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => setDeleteTarget(p)}
                            >
                              <Trash2 className="size-3.5" aria-hidden />
                              Törlés
                            </Button>
                          ) : null}
                        </div>
                        <ul className="space-y-0.5 pl-6 text-hint text-ink-secondary">
                          {describeSheetRules(p.rules).map((line) => (
                            <li key={line}>· {line}</li>
                          ))}
                        </ul>
                      </div>
                    </li>
                  )
                })}
              </ul>
            ) : null}

            {step === 2 && rules ? (
              <div className="grid gap-3 lg:grid-cols-2">
                <RuleGroup title="Időpontok és órák">
                  <Segmented
                    label="Milyen időpontok kerüljenek az ívre?"
                    value={r.times}
                    options={[
                      { value: 'real', label: 'Rögzített idők' },
                      { value: 'generated', label: 'Generált 8 órás idők' }
                    ]}
                    onChange={(v) => patch({ times: v })}
                  />
                  {r.times === 'generated' ? (
                    <>
                      <p className="flex gap-2 rounded-md border border-warning/40 bg-warning-soft/60 p-2 text-hint text-warning-ink">
                        <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                        A generált idők nem a terminálon rögzített időpontok. Az Mt. 134. §
                        a ténylegesen teljesített munkaidő nyilvántartását kéri — egyeztesd a
                        könyvelővel.
                      </p>
                      <div className="grid grid-cols-2 gap-3">
                        <FormField label="Nyitó kezdés" htmlFor="gen-open">
                          <Input
                            id="gen-open"
                            type="time"
                            value={r.generatedStartOpen}
                            onChange={(e) => patch({ generatedStartOpen: e.target.value })}
                          />
                        </FormField>
                        <FormField label="Záró kezdés" htmlFor="gen-close">
                          <Input
                            id="gen-close"
                            type="time"
                            value={r.generatedStartClose}
                            onChange={(e) => patch({ generatedStartClose: e.target.value })}
                          />
                        </FormField>
                      </div>
                      <div>
                        <p className="text-label text-ink">Nyitó / záró rotáció típusai</p>
                        <p className="mb-1.5 text-hint text-ink-secondary">
                          Ezek közül naponta egy dolgozó nyit, a következő zár. A többiek
                          napváltósan kezdenek.
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {(data?.employeeTypes ?? []).map((t) => {
                            const on = r.rotationTypeIds.includes(t.id)
                            return (
                              <button
                                key={t.id}
                                type="button"
                                aria-pressed={on}
                                onClick={() =>
                                  patch({
                                    rotationTypeIds: on
                                      ? r.rotationTypeIds.filter((x) => x !== t.id)
                                      : [...r.rotationTypeIds, t.id]
                                  })
                                }
                                className={cn(
                                  'inline-flex h-7 items-center gap-1 rounded-md border px-2.5 text-[13px] font-medium',
                                  on
                                    ? 'border-ink bg-ink text-white'
                                    : 'border-border bg-surface text-ink-secondary hover:bg-subtle'
                                )}
                              >
                                {on ? <Check className="size-3.5" aria-hidden /> : null}
                                {t.name}
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      <FormField
                        label="Igazítás a műszakhoz (perc)"
                        htmlFor="grace"
                        hint="Ennyi percen belüli korai/késői érkezés a műszak kezdetére számít."
                      >
                        <Input
                          id="grace"
                          type="number"
                          min={0}
                          max={30}
                          className="max-w-[120px]"
                          value={r.graceMinutes}
                          onChange={(e) =>
                            patch({
                              graceMinutes: Math.max(0, Math.min(30, Number(e.target.value) || 0))
                            })
                          }
                        />
                      </FormField>
                      <Switch
                        id="cap8"
                        checked={r.capDailyAt8}
                        onCheckedChange={(v) => patch({ capDailyAt8: v })}
                        label="Napi max. 8 óra normál idő"
                        description="A 8 óra feletti rész „+ X óra” túlóraként jelenik meg."
                      />
                      <Switch
                        id="policy-ot"
                        checked={r.includePolicyOvertime}
                        onCheckedChange={(v) => patch({ includePolicyOvertime: v })}
                        label="Dolgozói túlóra szabály"
                        description="Műszak utáni és korai túlóra a dolgozó beállítása szerint."
                      />
                    </>
                  )}
                </RuleGroup>

                <RuleGroup title="Szombat">
                  <Segmented
                    label="Szombati munka"
                    value={r.saturday}
                    options={[
                      { value: 'show_excluded', label: 'Látszik, nem számít' },
                      { value: 'shift_next_workday', label: 'Levonás a köv. munkanapból' },
                      { value: 'hidden', label: 'Rejtve' }
                    ]}
                    onChange={(v) => patch({ saturday: v })}
                    hint={
                      r.saturday === 'shift_next_workday'
                        ? 'A szombati percek a következő olyan munkanapból vonódnak le, amelyen van jelenlét — hónaphatáron át is.'
                        : undefined
                    }
                  />
                  {r.saturday === 'shift_next_workday' ? (
                    <FormField label="Szombat maximum (óra)" htmlFor="sat-max">
                      <Input
                        id="sat-max"
                        type="number"
                        min={0}
                        max={8}
                        step={0.5}
                        className="max-w-[120px]"
                        value={r.saturdayMaxMinutes / 60}
                        onChange={(e) =>
                          patch({
                            saturdayMaxMinutes: Math.round(
                              Math.max(0, Math.min(8, Number(e.target.value) || 0)) * 60
                            )
                          })
                        }
                      />
                    </FormField>
                  ) : null}
                </RuleGroup>

                <RuleGroup title="Ütköző napok">
                  <Segmented
                    label="Távollét (szabadság, beteg) + bejött dolgozni"
                    value={r.leavePlusWork}
                    options={[
                      { value: 'leave', label: 'Távollétként (0 óra)' },
                      { value: 'work', label: 'Munkaként' }
                    ]}
                    onChange={(v) => patch({ leavePlusWork: v })}
                  />
                  <Segmented
                    label="Munkaszüneti nap + bejött dolgozni"
                    value={r.holidayPlusWork}
                    options={[
                      { value: 'holiday', label: 'Munkaszünetként' },
                      { value: 'work', label: 'Munkaként' }
                    ]}
                    onChange={(v) => patch({ holidayPlusWork: v })}
                  />
                  <Segmented
                    label="Hiányos nap (csak érkezés vagy távozás)"
                    value={r.incomplete}
                    options={[
                      { value: 'label', label: 'HIÁNYOS felirat' },
                      { value: 'blank', label: 'Üres sor' }
                    ]}
                    onChange={(v) => patch({ incomplete: v })}
                  />
                </RuleGroup>

                <RuleGroup title="Megjelenés">
                  <Segmented
                    label="Ív típusa"
                    value={r.base}
                    options={[
                      { value: 'official', label: 'Hivatalos' },
                      { value: 'internal', label: 'Belső (papír)' }
                    ]}
                    onChange={(v) => patch({ base: v })}
                    hint="Belső ív: „BELSŐ · PAPÍR NÉZET” jelölés és túlóra összesítő."
                  />
                  <Switch
                    id="emp-sign"
                    checked={r.showEmployeeSignature}
                    onCheckedChange={(v) => patch({ showEmployeeSignature: v })}
                    label="Dolgozó aláírása mező"
                  />
                </RuleGroup>
              </div>
            ) : null}

            {step === 3 ? (
              <div className="grid min-h-[420px] gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
                <div className="flex min-h-0 flex-col gap-2">
                  {previewError ? (
                    <p
                      role="alert"
                      className="rounded-md border border-danger/30 bg-danger-soft p-2 text-hint text-danger-ink"
                    >
                      {previewError}
                    </p>
                  ) : null}
                  {preview && preview.missingCount > 0 ? (
                    <p className="text-hint text-ink-secondary">
                      {preview.missingCount} kijelölt dolgozó már nem létezik — kimarad.
                    </p>
                  ) : null}
                  {preview && totalWarnings > 0 ? (
                    <p className="flex items-center gap-1.5 text-hint text-warning-ink">
                      <AlertTriangle className="size-3.5" aria-hidden />
                      {totalWarnings} figyelmeztetés — nézd át letöltés előtt.
                    </p>
                  ) : null}
                  <div className="min-h-0 flex-1 overflow-auto rounded-md border border-border">
                    <table className="w-full text-[13px]">
                      <thead className="sticky top-0 bg-subtle text-left text-ink-secondary">
                        <tr>
                          <th className="px-2 py-1.5 font-medium">Dolgozó</th>
                          <th className="px-2 py-1.5 text-right font-medium">Óra</th>
                          <th className="px-2 py-1.5 text-right font-medium">Túlóra</th>
                          <th className="px-2 py-1.5 text-right font-medium">Nap</th>
                          <th className="px-2 py-1.5 text-right font-medium">Távoll.</th>
                          <th className="px-2 py-1.5 text-right font-medium">Szo</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(preview?.employees ?? []).map((e) => {
                          const active = e.id === previewEmployeeId
                          return (
                            <tr
                              key={e.id}
                              className={cn(
                                'border-t border-border align-top',
                                active && 'bg-primary/[0.04]'
                              )}
                            >
                              <td className="px-2 py-1.5">
                                <button
                                  type="button"
                                  className="text-left font-medium text-ink hover:underline"
                                  onClick={() => {
                                    setPreviewEmployeeId(e.id)
                                    void loadPreview(e.id)
                                  }}
                                  aria-pressed={active}
                                >
                                  {e.name}
                                </button>
                                {e.warnings.length > 0 ? (
                                  <ul className="mt-0.5 space-y-0.5 text-[12px] text-warning-ink">
                                    {e.warnings.map((w, i) => (
                                      <li key={i}>
                                        {w.date ? `${w.date.slice(5).replace('-', '.')} — ` : ''}
                                        {w.message}
                                      </li>
                                    ))}
                                  </ul>
                                ) : null}
                              </td>
                              <td className="px-2 py-1.5 text-right tabular-nums">
                                {hours(e.totalMinutes)}
                              </td>
                              <td className="px-2 py-1.5 text-right tabular-nums">
                                {e.overtimeMinutes > 0 ? hours(e.overtimeMinutes) : '—'}
                              </td>
                              <td className="px-2 py-1.5 text-right tabular-nums">{e.daysWorked}</td>
                              <td className="px-2 py-1.5 text-right tabular-nums">{e.absentDays}</td>
                              <td className="px-2 py-1.5 text-right tabular-nums">{e.saturdayDays}</td>
                            </tr>
                          )
                        })}
                        {previewLoading && !preview ? (
                          <tr>
                            <td colSpan={6} className="px-2 py-6 text-center text-ink-secondary">
                              Számolás…
                            </td>
                          </tr>
                        ) : null}
                      </tbody>
                    </table>
                  </div>

                  {employees.length > 1 ? (
                    <Segmented
                      label="Letöltés formája"
                      value={output}
                      options={[
                        { value: 'zip', label: 'ZIP (dolgozónként egy PDF)' },
                        { value: 'merged', label: 'Egy összefűzött PDF' }
                      ]}
                      onChange={setOutput}
                    />
                  ) : null}

                  {data?.canWrite && dirty ? (
                    <div className="space-y-2 rounded-md border border-border bg-subtle p-2.5">
                      <p className="text-label text-ink">Módosított szabályok mentése</p>
                      <div className="flex flex-wrap items-center gap-2">
                        <Input
                          value={saveName}
                          onChange={(e) => setSaveName(e.target.value)}
                          placeholder="Sablon neve"
                          aria-label="Sablon neve"
                          className="max-w-[220px]"
                        />
                        <Button
                          type="button"
                          variant="secondary"
                          disabled={busy}
                          onClick={() => savePreset(false)}
                        >
                          Mentés új sablonként
                        </Button>
                        {!selectedPreset.builtin ? (
                          <Button
                            type="button"
                            variant="secondary"
                            disabled={busy}
                            onClick={() => savePreset(true)}
                          >
                            „{selectedPreset.name}” frissítése
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  ) : null}
                </div>

                <div className="flex min-h-[420px] flex-col gap-1.5">
                  <p className="text-hint text-ink-secondary">
                    Előnézet: <span className="font-medium text-ink">{previewTarget?.name ?? '—'}</span>{' '}
                    · a logók csak a PDF-ben jelennek meg
                    {previewLoading ? ' · frissítés…' : ''}
                  </p>
                  <iframe
                    title="Jelenléti ív előnézet"
                    className="min-h-0 w-full flex-1 rounded-md border border-border bg-white"
                    srcDoc={preview?.html ?? ''}
                    sandbox=""
                  />
                </div>
              </div>
            ) : null}
          </div>

          <DialogFooter className="flex-row items-center justify-between gap-2 sm:justify-between">
            <Button
              type="button"
              variant="secondary"
              disabled={busy}
              onClick={() => onOpenChange(false)}
            >
              Mégse
            </Button>
            <div className="flex gap-2">
              {step > 0 ? (
                <Button
                  type="button"
                  variant="secondary"
                  disabled={busy}
                  onClick={() => setStep(step - 1)}
                >
                  Vissza
                </Button>
              ) : null}
              {step < STEPS.length - 1 ? (
                <Button
                  type="button"
                  disabled={!data || employees.length === 0}
                  onClick={() => goTo(step + 1)}
                >
                  Tovább: {STEPS[step + 1]}
                </Button>
              ) : (
                <Button
                  type="button"
                  loading={downloading}
                  disabled={busy || previewLoading || !preview}
                  onClick={download}
                >
                  <FileDown className="size-3.5" aria-hidden />
                  {employees.length === 1
                    ? 'PDF letöltése'
                    : output === 'zip'
                      ? `ZIP letöltése (${employees.length})`
                      : `PDF letöltése (${employees.length})`}
                </Button>
              )}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(o) => {
          if (!o && !pending) setDeleteTarget(null)
        }}
        title="Sablon törlése"
        description={`Biztosan törlöd a „${deleteTarget?.name ?? ''}” sablont? Az egész cég számára eltűnik.`}
        confirmLabel="Sablon törlése"
        cancelLabel="Mégse"
        loading={pending}
        onConfirm={confirmDeletePreset}
      />
    </>
  )
}
