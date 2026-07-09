"use client"

import { useCallback, useMemo } from "react"
import { FileText, RotateCcw, Save } from "lucide-react"
import { useAppSettingsPage } from "@/hooks/use-app-settings-page"
import { PageHeader } from "@/components/shell/page-header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

const numericInputNoSpinner =
  "[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none [-moz-appearance:textfield]"

export function DocumentSettingsClient() {
  const { loading, form, setForm, saving, handleSave, handleReset } = useAppSettingsPage()

  const patch = useCallback(
    <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => {
      setForm((prev) => ({ ...prev, [key]: value }))
    },
    [setForm]
  )

  const patchDays = useCallback(
    (key: "offerValidityDays" | "rfqDefaultValidityDays", value: string) => {
      const parsed = Number.parseInt(value, 10)
      patch(key, Number.isFinite(parsed) ? Math.max(1, parsed) : 1)
    },
    [patch]
  )

  const notesPreview = useMemo(() => {
    const parts = [form.offerDefaultNotes.trim(), form.offerDefaultPaymentTerms.trim()].filter(Boolean)
    return parts.join("\n\n")
  }, [form.offerDefaultNotes, form.offerDefaultPaymentTerms])

  const tigPreview = useMemo(() => {
    const prefix = form.tigDocumentPrefix.trim() || "TIG"
    const year = new Date().getFullYear()
    return `${prefix}-IRO-${year}-001`
  }, [form.tigDocumentPrefix])

  if (loading) {
    return <div className="h-64 animate-pulse rounded-lg bg-[var(--muted)]" />
  }

  return (
    <>
      <PageHeader
        title="Dokumentumok"
        description="Árajánlat sablon szövegek, érvényességi idők és TIG sorszám formátum"
        actions={
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => void handleReset()} disabled={saving}>
              <RotateCcw className="mr-1.5 h-4 w-4" />
              Alapértelmezés
            </Button>
            <Button type="button" size="sm" onClick={() => void handleSave()} disabled={saving}>
              <Save className="mr-1.5 h-4 w-4" />
              Mentés
            </Button>
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(18rem,1fr)]">
        <div className="space-y-6">
          <section className="rounded-xl border bg-white p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-900">Érvényesség</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="offer-validity">Árajánlat érvényessége (nap)</Label>
                <Input
                  id="offer-validity"
                  type="number"
                  min={1}
                  step={1}
                  className={numericInputNoSpinner}
                  value={form.offerValidityDays}
                  onChange={(e) => patchDays("offerValidityDays", e.target.value)}
                />
                <p className="text-[11px] text-slate-500">Közzétételkor számítódik a lejárati dátum.</p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="rfq-validity">Alvállalkozói RFQ alapértelmezett (nap)</Label>
                <Input
                  id="rfq-validity"
                  type="number"
                  min={1}
                  step={1}
                  className={numericInputNoSpinner}
                  value={form.rfqDefaultValidityDays}
                  onChange={(e) => patchDays("rfqDefaultValidityDays", e.target.value)}
                />
                <p className="text-[11px] text-slate-500">Új RFQ meghívó létrehozásakor.</p>
              </div>
            </div>
          </section>

          <section className="rounded-xl border bg-white p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-900">Árajánlat sablon szövegek</h2>
            <p className="mt-1 text-xs text-slate-600">
              Új árajánlat piszkozat létrehozásakor a megjegyzés mezőbe kerülnek (szerkeszthetők tovább).
            </p>
            <div className="mt-4 space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="offer-notes">Általános megjegyzés</Label>
                <Textarea
                  id="offer-notes"
                  rows={4}
                  value={form.offerDefaultNotes}
                  onChange={(e) => patch("offerDefaultNotes", e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="offer-payment">Fizetési feltétel</Label>
                <Textarea
                  id="offer-payment"
                  rows={3}
                  value={form.offerDefaultPaymentTerms}
                  onChange={(e) => patch("offerDefaultPaymentTerms", e.target.value)}
                />
              </div>
            </div>
          </section>

          <section className="rounded-xl border bg-white p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-900">TIG sorszám</h2>
            <p className="mt-1 text-xs text-slate-600">
              Formátum: <span className="font-mono text-slate-800">{"{prefix}-{projektkód}-{év}-{sorszám}"}</span>
            </p>
            <div className="mt-4 max-w-xs space-y-1.5">
              <Label htmlFor="tig-prefix">Prefix</Label>
              <Input
                id="tig-prefix"
                value={form.tigDocumentPrefix}
                onChange={(e) => patch("tigDocumentPrefix", e.target.value)}
                placeholder="TIG"
              />
            </div>
          </section>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900">
              <FileText className="h-4 w-4 text-slate-500" />
              Előnézet
            </div>
            <div className="space-y-4 text-xs text-slate-600">
              <div>
                <p className="font-medium text-slate-800">TIG sorszám</p>
                <p className="mt-1 font-mono text-sm text-slate-900">{tigPreview}</p>
              </div>
              <div>
                <p className="font-medium text-slate-800">Árajánlat megjegyzés (összeállítva)</p>
                <pre className="mt-1 whitespace-pre-wrap rounded-md border border-slate-200 bg-slate-50/80 p-3 text-[11px] leading-relaxed text-slate-700">
                  {notesPreview || "—"}
                </pre>
                <p className="mt-2 text-[11px] text-slate-500">
                  Piszkozat létrehozásakor ez a szöveg kerül a megjegyzés mezőbe.
                </p>
              </div>
            </div>
          </section>
        </aside>
      </div>
    </>
  )
}
