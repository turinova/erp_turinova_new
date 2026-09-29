'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import ExcelJS from 'exceljs'
import JSZip from 'jszip'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  lockFinancePeriodAction,
  unlockFinancePeriodAction
} from '@/lib/finance/actions'
import { formatMoneyFt } from '@/lib/sales/parse'

export type ExportInvoiceRow = {
  id: string
  internal_number: string
  provider_invoice_number: string | null
  invoice_type: string
  customer_name: string | null
  fulfillment_date: string | null
  payment_due_date: string | null
  net_total: number | null
  vat_total: number | null
  gross_total: number | null
  payment_status: string
  related_source_type: string
  related_source_number: string | null
}

export type ExportLineRow = {
  invoice_id: string
  line_no: number
  name: string
  vat_percent: number
  line_net: number
  line_vat: number
  line_gross: number
}

export type LockRow = {
  period_ym: string
  locked_at: string
  note: string | null
}

type Props = {
  period: string
  invoices: ExportInvoiceRow[]
  lines: ExportLineRow[]
  locks: LockRow[]
  canWrite: boolean
  canUnlock: boolean
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function FinanceExportsClient({
  period,
  invoices,
  lines,
  locks,
  canWrite,
  canUnlock
}: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [msg, setMsg] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const locked = locks.some((l) => l.period_ym === period)

  async function exportXlsx() {
    const wb = new ExcelJS.Workbook()
    const invSheet = wb.addWorksheet('Bizonylatok')
    invSheet.addRow([
      'Belső',
      'Számlaszám',
      'Típus',
      'Vevő',
      'Teljesítés',
      'Határidő',
      'Nettó',
      'ÁFA',
      'Bruttó',
      'Fizetés',
      'Forrás',
      'Forrás szám'
    ])
    for (const r of invoices) {
      invSheet.addRow([
        r.internal_number,
        r.provider_invoice_number,
        r.invoice_type,
        r.customer_name,
        r.fulfillment_date,
        r.payment_due_date,
        r.net_total,
        r.vat_total,
        r.gross_total,
        r.payment_status,
        r.related_source_type,
        r.related_source_number
      ])
    }
    const lineSheet = wb.addWorksheet('Tételek')
    lineSheet.addRow([
      'invoice_id',
      'Sor',
      'Megnevezés',
      'ÁFA %',
      'Nettó',
      'ÁFA',
      'Bruttó'
    ])
    for (const l of lines) {
      lineSheet.addRow([
        l.invoice_id,
        l.line_no,
        l.name,
        l.vat_percent,
        l.line_net,
        l.line_vat,
        l.line_gross
      ])
    }
    const buf = await wb.xlsx.writeBuffer()
    downloadBlob(
      new Blob([buf], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      }),
      `bizonylatok-${period}.xlsx`
    )
  }

  async function exportCsv() {
    const header =
      'belso;szamlaszam;tipus;vevo;teljesites;hatarido;netto;afa;brutto;fizetes\n'
    const body = invoices
      .map((r) =>
        [
          r.internal_number,
          r.provider_invoice_number,
          r.invoice_type,
          r.customer_name,
          r.fulfillment_date,
          r.payment_due_date,
          r.net_total,
          r.vat_total,
          r.gross_total,
          r.payment_status
        ]
          .map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`)
          .join(';')
      )
      .join('\n')
    downloadBlob(
      new Blob([header + body], { type: 'text/csv;charset=utf-8' }),
      `bizonylatok-${period}.csv`
    )
  }

  async function exportZipMeta() {
    const zip = new JSZip()
    zip.file(
      `bizonylatok-${period}.json`,
      JSON.stringify({ period, invoices, lines }, null, 2)
    )
    const blob = await zip.generateAsync({ type: 'blob' })
    downloadBlob(blob, `penzugy-${period}.zip`)
  }

  function lockPeriod() {
    setMsg(null)
    setErr(null)
    startTransition(async () => {
      const r = await lockFinancePeriodAction({ periodYm: period })
      if (!r.ok) {
        setErr(r.message)
        return
      }
      setMsg(r.message ?? 'Lezárva.')
      router.refresh()
    })
  }

  function unlockPeriod() {
    setMsg(null)
    setErr(null)
    startTransition(async () => {
      const r = await unlockFinancePeriodAction({ periodYm: period })
      if (!r.ok) {
        setErr(r.message)
        return
      }
      setMsg(r.message ?? 'Feloldva.')
      router.refresh()
    })
  }

  const grossSum = invoices.reduce((s, r) => s + (Number(r.gross_total) || 0), 0)

  return (
    <div className="space-y-4">
      <form className="flex flex-wrap items-end gap-2" method="get">
        <div>
          <Label htmlFor="exp-period">Időszak</Label>
          <Input
            id="exp-period"
            name="period"
            type="month"
            defaultValue={period}
            className="mt-1"
          />
        </div>
        <Button type="submit" variant="secondary">
          Mutatás
        </Button>
      </form>

      <p className="text-body text-ink-secondary">
        {period} · {invoices.length} bizonylat · bruttó{' '}
        <span className="font-semibold tabular-nums text-ink">
          {formatMoneyFt(grossSum)} Ft
        </span>
        {locked ? (
          <span className="ml-2 text-danger-ink">· Lezárva</span>
        ) : null}
      </p>

      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="secondary" onClick={() => void exportXlsx()}>
          XLSX (bizonylat + tétel)
        </Button>
        <Button type="button" variant="secondary" onClick={() => void exportCsv()}>
          CSV
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={() => void exportZipMeta()}
        >
          ZIP (JSON meta)
        </Button>
      </div>

      <div className="rounded-md border border-border bg-subtle px-3 py-3 text-body text-ink-secondary">
        <p className="font-medium text-ink">Adóhatósági ellenőrzési export</p>
        <p className="mt-1 text-hint">
          Ezt a Számlázz.hu webes felületén kell futtatni (Agent API nem adja).
          Nyisd meg a Számlázz fiókot → Listák / Adatexportok → Adóhatósági
          ellenőrzési adatszolgáltatás.
        </p>
        <a
          href="https://www.szamlazz.hu/szamla/"
          target="_blank"
          rel="noreferrer"
          className="mt-2 inline-block text-[13px] font-medium text-ink underline-offset-2 hover:underline"
        >
          Számlázz.hu megnyitása
        </a>
      </div>

      {canWrite ? (
        <div className="flex flex-wrap items-center gap-2 rounded-md border border-border px-3 py-3">
          <p className="mr-auto text-[13px] text-ink-secondary">
            Hónap soft-lock: visszadátumozott új számla tiltása.
          </p>
          {!locked ? (
            <Button
              type="button"
              onClick={lockPeriod}
              loading={pending}
            >
              {period} lezárása
            </Button>
          ) : canUnlock ? (
            <Button
              type="button"
              variant="secondary"
              onClick={unlockPeriod}
              loading={pending}
            >
              Feloldás
            </Button>
          ) : (
            <span className="text-hint text-ink-muted">
              Feloldáshoz owner/admin kell.
            </span>
          )}
        </div>
      ) : null}

      {msg ? (
        <p className="text-hint text-success-ink" role="status">
          {msg}
        </p>
      ) : null}
      {err ? (
        <p className="text-hint text-danger-ink" role="alert">
          {err}
        </p>
      ) : null}

      {locks.length > 0 ? (
        <div>
          <p className="mb-1 text-hint font-medium text-ink-muted">
            Lezárt időszakok
          </p>
          <ul className="space-y-1 text-[13px] text-ink-secondary">
            {locks.map((l) => (
              <li key={l.period_ym}>
                {l.period_ym}
                {l.note ? ` — ${l.note}` : ''}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  )
}
