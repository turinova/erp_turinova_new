'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import {
  Factory,
  FileDown,
  FileText,
  FolderKanban,
  MessageSquare,
  ScanSearch,
  Send,
  ShoppingCart
} from 'lucide-react'
import { toast } from 'sonner'

import { AddPaymentDialog } from '@/components/quotes/add-payment-dialog'
import { AssignProductionDialog } from '@/components/quotes/assign-production-dialog'
import { CreateOrderDialog } from '@/components/quotes/create-order-dialog'
import { QuoteBarcodeDisplay } from '@/components/quotes/quote-barcode-display'
import { ConfirmDialog } from '@/components/patterns/confirm-dialog'
import {
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableHead,
  DataTableHeaderCell,
  DataTableRow
} from '@/components/patterns/data-table'
import { StatusBadge } from '@/components/patterns/status-badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import {
  PARTNER_OPTI_PATH,
  PARTNER_ORDERS_PATH,
  PARTNER_QUOTES_PATH
} from '@/lib/auth/surface'
import { usePartnerHref } from '@/lib/auth/use-partner-href'
import type { TenantCompanyRow } from '@/lib/company/queries'
import {
  formatQuotePrice
} from '@/lib/opti/quote-calculations'
import type { PaymentMethodOption } from '@/lib/payment-methods/queries'
import type { ProductionMachineOption } from '@/lib/production-machines/queries'
import { updateQuoteComment, updateQuoteProjectName } from '@/lib/quotes/actions'
import {
  loadPaymentMethodsAction,
  loadProductionMachinesAction,
  loadQuoteExportTargetsAction
} from '@/lib/quotes/detail-lazy-actions'
import {
  softDeletePartnerQuote,
  submitPartnerQuote,
  updatePartnerQuoteComment,
  updatePartnerQuoteProjectName
} from '@/lib/quotes/partner-actions'
import {
  PROJECT_NAME_MAX_LENGTH
} from '@/lib/quotes/project-name'
import {
  exportFormatLabel,
  type QuoteExportTarget
} from '@/lib/quotes/export/types'
import {
  PAYMENT_STATUS_LABEL,
  paymentStatusTone
} from '@/lib/quotes/payment-labels'
import {
  partnerQuoteStatusLabel,
  partnerQuoteStatusTone
} from '@/lib/quotes/partner-status-labels'
import {
  QUOTE_STATUS_LABEL,
  quoteStatusTone
} from '@/lib/quotes/status-labels'
import {
  isQuoteEditableInOpti,
  type QuoteDetail
} from '@/lib/quotes/queries'
import { cn } from '@/lib/utils'

type QuoteDetailClientProps = {
  quote: QuoteDetail
  company: TenantCompanyRow | null
  canWrite: boolean
  /** Partner portal — ugyanaz a dokumentum layout, más műveletek */
  surface?: 'staff' | 'partner'
}

function InfoCard({
  title,
  children,
  className
}: {
  title: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'rounded-md border border-border bg-subtle/50 p-3',
        className
      )}
    >
      <h3 className="mb-1.5 text-body font-semibold text-ink">{title}</h3>
      <div className="text-body leading-relaxed text-ink-secondary">
        {children}
      </div>
    </div>
  )
}

export function QuoteDetailClient({
  quote,
  company,
  canWrite,
  surface = 'staff'
}: QuoteDetailClientProps) {
  const router = useRouter()
  const partnerHref = usePartnerHref()
  const isPartner = surface === 'partner'
  const isPartnerDraft =
    isPartner && quote.source === 'portal' && quote.portal_submitted_at == null
  const isPartnerSubmitted =
    isPartner && quote.source === 'portal' && quote.portal_submitted_at != null
  const listHref = isPartner
    ? partnerHref(
        isPartnerSubmitted ? PARTNER_ORDERS_PATH : PARTNER_QUOTES_PATH
      )
    : '/ajanlatok'
  const optiHref = isPartner
    ? `${partnerHref(PARTNER_OPTI_PATH)}?quote_id=${quote.id}`
    : `/opti?quote_id=${quote.id}`

  const [commentOpen, setCommentOpen] = useState(false)
  const [commentDraft, setCommentDraft] = useState(quote.comment ?? '')
  const [projectOpen, setProjectOpen] = useState(false)
  const [projectDraft, setProjectDraft] = useState(quote.project_name ?? '')
  const [pending, startTransition] = useTransition()
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false)
  const [isExportingExcel, setIsExportingExcel] = useState(false)
  const [excelPickerOpen, setExcelPickerOpen] = useState(false)
  const [orderDialogOpen, setOrderDialogOpen] = useState(false)
  const [addPaymentOpen, setAddPaymentOpen] = useState(false)
  const [productionDialogOpen, setProductionDialogOpen] = useState(false)
  const [selectedEquipmentId, setSelectedEquipmentId] = useState('')
  const [submitOpen, setSubmitOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)

  const [exportTargets, setExportTargets] = useState<QuoteExportTarget[]>([])
  const [exportTargetsLoaded, setExportTargetsLoaded] = useState(false)
  const [exportTargetsLoading, setExportTargetsLoading] = useState(false)
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodOption[]>(
    []
  )
  const [productionMachines, setProductionMachines] = useState<
    ProductionMachineOption[]
  >([])
  const [dialogOptionsLoading, setDialogOptionsLoading] = useState(false)

  const aliveExportTargets = exportTargets.filter((t) => !t.isDeleted)
  const orphanExportTargets = exportTargets.filter((t) => t.isDeleted)
  const orphanPanelCount = orphanExportTargets.reduce(
    (sum, t) => sum + t.panelCount,
    0
  )

  async function ensureExportTargets(): Promise<QuoteExportTarget[] | null> {
    if (exportTargetsLoaded) return exportTargets
    setExportTargetsLoading(true)
    try {
      const result = await loadQuoteExportTargetsAction(quote.id)
      if (!result.ok) {
        toast.error(result.message)
        return null
      }
      setExportTargets(result.targets)
      setExportTargetsLoaded(true)
      return result.targets
    } finally {
      setExportTargetsLoading(false)
    }
  }

  async function ensurePaymentMethods(): Promise<PaymentMethodOption[] | null> {
    if (paymentMethods.length > 0) return paymentMethods
    setDialogOptionsLoading(true)
    try {
      const result = await loadPaymentMethodsAction()
      if (!result.ok) {
        toast.error(result.message)
        return null
      }
      setPaymentMethods(result.methods)
      return result.methods
    } finally {
      setDialogOptionsLoading(false)
    }
  }

  async function ensureProductionMachines(): Promise<
    ProductionMachineOption[] | null
  > {
    if (productionMachines.length > 0) return productionMachines
    setDialogOptionsLoading(true)
    try {
      const result = await loadProductionMachinesAction()
      if (!result.ok) {
        toast.error(result.message)
        return null
      }
      setProductionMachines(result.machines)
      return result.machines
    } finally {
      setDialogOptionsLoading(false)
    }
  }

  const canEditInOpti = isPartner
    ? isPartnerDraft
    : canWrite && isQuoteEditableInOpti(quote.status)

  const canEditComment = isPartner ? isPartnerDraft : canWrite
  const canEditProjectName = canEditComment

  const canAddPayment =
    !isPartner &&
    canWrite &&
    Boolean(quote.order_number) &&
    quote.status !== 'draft' &&
    quote.status !== 'cancelled' &&
    quote.payment_status !== 'paid'

  const canAssignProduction =
    !isPartner &&
    canWrite &&
    Boolean(quote.order_number) &&
    (quote.status === 'ordered' || quote.status === 'in_production')

  /** Egy primary / képernyő — státusz szerinti fő következő lépés. */
  const primaryAction:
    | 'order'
    | 'production'
    | 'payment'
    | 'opti'
    | 'submit'
    | 'pdf'
    | null = isPartner
    ? isPartnerDraft
      ? 'submit'
      : 'pdf'
    : canWrite && quote.status === 'draft'
      ? 'order'
      : canWrite && quote.status === 'ordered'
        ? 'production'
        : canAddPayment
          ? 'payment'
          : canEditInOpti
            ? 'opti'
            : null

  const statusLabel = isPartner
    ? isPartnerDraft
      ? 'Piszkozat'
      : partnerQuoteStatusLabel(quote.status)
    : (QUOTE_STATUS_LABEL[quote.status] ?? quote.status)
  const statusTone = isPartner
    ? isPartnerDraft
      ? 'neutral'
      : partnerQuoteStatusTone(quote.status)
    : quoteStatusTone(quote.status)
  const showPartnerPayment = isPartnerSubmitted
  const showStaffPayment = !isPartner && quote.status !== 'draft'

  const hasBilling =
    Boolean(quote.customer.billing_name) ||
    Boolean(quote.customer.billing_city) ||
    Boolean(quote.customer.billing_street) ||
    Boolean(quote.customer.billing_tax_number)

  async function downloadExcel(
    equipmentId: string,
    targetsOverride?: QuoteExportTarget[]
  ) {
    const pool = targetsOverride ?? exportTargets
    const alive = pool.filter((t) => !t.isDeleted)
    const orphans = pool.filter((t) => t.isDeleted)
    const orphanCount = orphans.reduce((sum, t) => sum + t.panelCount, 0)
    const target = alive.find((t) => t.equipmentId === equipmentId)
    if (!target) {
      toast.error(
        orphanCount > 0
          ? 'A panelek törölt berendezéshez kötöttek — kösd át az anyagot élő gépre.'
          : 'Válassz berendezést az exporthoz.'
      )
      return
    }
    if (target.missingMachineCodeCount > 0) {
      toast.message('Hiányzó gépkód', {
        description: `${target.missingMachineCodeCount} panelnél nincs anyag gépkód — ellenőrizd a törzsadatot.`
      })
    }

    setIsExportingExcel(true)
    try {
      const response = await fetch(
        `/api/ajanlatok/${quote.id}/export-excel?equipment_id=${encodeURIComponent(equipmentId)}`
      )
      if (!response.ok) {
        const errorData = (await response.json().catch(() => ({
          error: 'Ismeretlen hiba'
        }))) as { error?: string }
        throw new Error(errorData.error || 'Excel generálás sikertelen')
      }

      const blob = await response.blob()
      const contentDisposition = response.headers.get('Content-Disposition')
      const filenameMatch = contentDisposition?.match(/filename="(.+)"/)
      const filename =
        filenameMatch?.[1] ?? `quote_${quote.quote_number}.xlsx`

      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = filename
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)

      toast.success(`Excel letöltve: ${filename}`)
      setExcelPickerOpen(false)
    } catch (error) {
      console.error('Error exporting Excel:', error)
      toast.error(
        'Hiba az Excel export során: ' +
          (error instanceof Error ? error.message : 'Ismeretlen hiba')
      )
    } finally {
      setIsExportingExcel(false)
    }
  }

  async function handleExcelClick() {
    const targets = await ensureExportTargets()
    if (!targets) return
    const alive = targets.filter((t) => !t.isDeleted)
    if (alive.length === 0) {
      toast.error('Nincs exportálható panel (vagy a berendezés törölve).')
      return
    }
    if (alive.length === 1) {
      void downloadExcel(alive[0].equipmentId, targets)
      return
    }
    setSelectedEquipmentId(alive[0]?.equipmentId ?? '')
    setExcelPickerOpen(true)
  }

  async function openOrderDialog() {
    const methods = await ensurePaymentMethods()
    if (!methods) return
    setOrderDialogOpen(true)
  }

  async function openPaymentDialog() {
    const methods = await ensurePaymentMethods()
    if (!methods) return
    setAddPaymentOpen(true)
  }

  async function openProductionDialog() {
    const machines = await ensureProductionMachines()
    if (!machines) return
    setProductionDialogOpen(true)
  }

  function handleSaveComment() {
    startTransition(async () => {
      const result = isPartner
        ? await updatePartnerQuoteComment(quote.id, commentDraft)
        : await updateQuoteComment(quote.id, commentDraft)
      if (!result?.ok) {
        toast.error(result?.message ?? 'Nem sikerült menteni a megjegyzést.')
        return
      }
      toast.success('Megjegyzés mentve.')
      setCommentOpen(false)
      router.refresh()
    })
  }

  function handleSaveProjectName() {
    startTransition(async () => {
      const result = isPartner
        ? await updatePartnerQuoteProjectName(quote.id, projectDraft)
        : await updateQuoteProjectName(quote.id, projectDraft)
      if (!result?.ok) {
        toast.error(result?.message ?? 'Nem sikerült menteni a projekt nevét.')
        return
      }
      toast.success('Projekt neve mentve.')
      setProjectOpen(false)
      router.refresh()
    })
  }

  function handlePartnerSubmit() {
    startTransition(async () => {
      const result = await submitPartnerQuote(quote.id)
      if (!result?.ok) {
        toast.error(result?.message ?? 'Nem sikerült beküldeni.')
        return
      }
      toast.success(`Beküldve: ${result.quoteNumber}`)
      setSubmitOpen(false)
      router.push(`${partnerHref(PARTNER_ORDERS_PATH)}/${quote.id}`)
      router.refresh()
    })
  }

  function handlePartnerDelete() {
    startTransition(async () => {
      const result = await softDeletePartnerQuote(quote.id)
      if (!result?.ok) {
        toast.error(result?.message ?? 'Nem sikerült törölni.')
        return
      }
      toast.success('Ajánlat törölve.')
      setDeleteOpen(false)
      router.push(partnerHref(PARTNER_QUOTES_PATH))
      router.refresh()
    })
  }

  async function handleGeneratePdf() {
    setIsGeneratingPdf(true)
    try {
      const response = await fetch(`/api/ajanlatok/${quote.id}/pdf`)
      if (!response.ok) {
        const errorData = (await response.json().catch(() => ({
          error: 'Ismeretlen hiba'
        }))) as { error?: string }
        throw new Error(errorData.error || 'Hiba történt a PDF generálása során')
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `Arajanlat-${quote.quote_number}.pdf`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)

      toast.success('PDF sikeresen generálva és letöltve')
    } catch (error) {
      console.error('Error generating PDF:', error)
      toast.error(
        'Hiba történt a PDF generálása során: ' +
          (error instanceof Error ? error.message : 'Ismeretlen hiba')
      )
    } finally {
      setIsGeneratingPdf(false)
    }
  }

  return (
    <div className="space-y-4">
      {isPartner ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-hint text-amber-950">
          <span className="font-semibold">Asztalos portál</span>
          {' · '}
          {isPartnerDraft
            ? 'Piszkozat — beküldésig csak te látod.'
            : 'Beküldött rendelés a kapcsolt cégnél (olvasás).'}
        </div>
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        <Link
          href={listHref}
          className="text-body text-ink-secondary underline-offset-2 hover:text-ink hover:underline"
        >
          ← Lista
        </Link>
        <h1 className="text-h1 text-ink">
          {isPartner
            ? isPartnerDraft
              ? `Ajánlatom: ${quote.quote_number}`
              : `Rendelésem: ${quote.order_number ?? quote.quote_number}`
            : `Árajánlat: ${quote.quote_number}`}
        </h1>
        <StatusBadge tone={statusTone}>{statusLabel}</StatusBadge>
        {!isPartner &&
        quote.source === 'portal' &&
        quote.portal_submitted_at ? (
          <StatusBadge tone="warning">Online</StatusBadge>
        ) : null}
      </div>
      {quote.project_name ? (
        <p className="-mt-2 text-body text-ink-secondary">{quote.project_name}</p>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-12">
        {/* Left: document */}
        <div className="space-y-3 lg:col-span-9">
          {exportTargetsLoaded && orphanPanelCount > 0 && !isPartner ? (
            <p
              className="rounded-md border border-warning/40 bg-warning-soft px-3 py-2 text-body text-warning-ink"
              role="status"
            >
              {orphanPanelCount} panel törölt berendezéshez kötött. Nyisd meg a
              táblás anyagot, válassz élő gépet (pl. Korpus), majd mentsd —
              utána az Excel export újra elérhető.
            </p>
          ) : null}
          <section className="space-y-3 rounded-lg border border-border bg-surface p-3 sm:p-4">
            <div
              className={
                !isPartner && quote.barcode
                  ? 'grid gap-3 sm:grid-cols-[1fr_auto] sm:items-stretch'
                  : undefined
              }
            >
              <InfoCard title="Cégadatok">
                {company ? (
                  <>
                    <p className="font-medium text-ink">{company.name}</p>
                    <p>
                      {[company.postal_code, company.city]
                        .filter(Boolean)
                        .join(' ')}
                      {company.address ? `, ${company.address}` : ''}
                    </p>
                    {company.tax_number ? (
                      <p>Adószám: {company.tax_number}</p>
                    ) : null}
                    {company.company_registration_number ? (
                      <p>
                        Cégjegyzékszám: {company.company_registration_number}
                      </p>
                    ) : null}
                    {company.email ? <p>E-mail: {company.email}</p> : null}
                    {company.phone_number ? (
                      <p>Tel: {company.phone_number}</p>
                    ) : null}
                  </>
                ) : (
                  <p>
                    {isPartner
                      ? 'A kapcsolt cégnek nincs megadott cégadata.'
                      : 'Nincs cégadat. Állítsd be: Beállítások → Cégadatok.'}
                  </p>
                )}
              </InfoCard>
              {!isPartner && quote.barcode ? (
                <QuoteBarcodeDisplay barcode={quote.barcode} />
              ) : null}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <InfoCard title="Ügyfél adatok">
                <p className="font-medium text-ink">{quote.customer.name}</p>
                {quote.customer.email ? <p>{quote.customer.email}</p> : null}
                {quote.customer.mobile ? <p>{quote.customer.mobile}</p> : null}
              </InfoCard>

              <InfoCard title="Számlázási adatok">
                {hasBilling ? (
                  <>
                    {quote.customer.billing_name ? (
                      <p className="font-medium text-ink">
                        {quote.customer.billing_name}
                      </p>
                    ) : null}
                    <p>
                      {[
                        quote.customer.billing_postal_code,
                        quote.customer.billing_city
                      ]
                        .filter(Boolean)
                        .join(' ')}
                    </p>
                    <p>
                      {[
                        quote.customer.billing_street,
                        quote.customer.billing_house_number
                      ]
                        .filter(Boolean)
                        .join(' ')}
                    </p>
                    {quote.customer.billing_country ? (
                      <p>{quote.customer.billing_country}</p>
                    ) : null}
                    {quote.customer.billing_tax_number ? (
                      <p>Adószám: {quote.customer.billing_tax_number}</p>
                    ) : null}
                    {quote.customer.billing_company_reg_number ? (
                      <p>
                        Cégjegyzékszám:{' '}
                        {quote.customer.billing_company_reg_number}
                      </p>
                    ) : null}
                  </>
                ) : (
                  <p>Nincs számlázási adat megadva.</p>
                )}
              </InfoCard>
            </div>

            <div className="border-t border-border pt-3">
              <h2 className="mb-3 text-center text-h3 font-semibold text-ink">
                Árajánlat összesítése
              </h2>

              {/* 1) Anyagok — main struktúra */}
              <div className="mb-3 overflow-hidden rounded-md border border-border bg-subtle/40">
                <DataTable className="rounded-none border-0">
                  <DataTableHead>
                    <DataTableRow>
                      <DataTableHeaderCell>Anyag</DataTableHeaderCell>
                      <DataTableHeaderCell className="text-center">
                        Hull. szorzó
                      </DataTableHeaderCell>
                      <DataTableHeaderCell className="text-right">
                        Mennyiség
                      </DataTableHeaderCell>
                      <DataTableHeaderCell className="text-right">
                        Nettó ár
                      </DataTableHeaderCell>
                      <DataTableHeaderCell className="text-right">
                        Bruttó ár
                      </DataTableHeaderCell>
                    </DataTableRow>
                  </DataTableHead>
                  <DataTableBody>
                    {quote.material_lines.length === 0 ? (
                      <DataTableRow>
                        <DataTableCell
                          colSpan={5}
                          className="text-center text-ink-secondary"
                        >
                          Nincs árazási adat.
                        </DataTableCell>
                      </DataTableRow>
                    ) : (
                      quote.material_lines.map((line) => {
                        const boardAreaM2 =
                          (line.board_grain_mm * line.board_cross_mm) /
                          1_000_000
                        const boardsUsed = line.boards_charged || 0
                        const chargedSqm = line.charged_sqm || 0
                        const wasteMulti = line.waste_multi || 1
                        const totalBoardsArea = boardAreaM2 * boardsUsed
                        const totalArea = totalBoardsArea + chargedSqm
                        const unitPriceGross =
                          totalArea > 0 ? line.material_gross / totalArea : 0
                        const roundedUnitPriceGross =
                          Math.round(unitPriceGross * 100) / 100
                        const recalculatedTotalGross =
                          roundedUnitPriceGross * totalArea
                        const recalculatedTotalNet =
                          line.material_gross > 0
                            ? line.material_net *
                              (recalculatedTotalGross / line.material_gross)
                            : line.material_net
                        const displaySqm = chargedSqm / wasteMulti

                        return (
                          <DataTableRow key={line.id}>
                            <DataTableCell className="text-ink">
                              {line.material_name}
                            </DataTableCell>
                            <DataTableCell className="text-center">
                              <span className="inline-flex rounded border border-border bg-surface px-1.5 py-0.5 text-hint font-medium tabular-nums text-ink">
                                {wasteMulti.toFixed(2)}x
                              </span>
                            </DataTableCell>
                            <DataTableCell className="text-right tabular-nums text-ink">
                              {displaySqm.toFixed(2)} m² / {boardsUsed} db
                            </DataTableCell>
                            <DataTableCell className="text-right tabular-nums text-ink">
                              {formatQuotePrice(
                                Math.round(recalculatedTotalNet),
                                quote.currency
                              )}
                            </DataTableCell>
                            <DataTableCell className="text-right tabular-nums text-ink">
                              {formatQuotePrice(
                                Math.round(recalculatedTotalGross),
                                quote.currency
                              )}
                            </DataTableCell>
                          </DataTableRow>
                        )
                      })
                    )}
                  </DataTableBody>
                </DataTable>
              </div>

              {/* 2) Szolgáltatások — szabás + élzárás (main struktúra, V1: nincs pánthely…) */}
              <div className="mb-3 overflow-hidden rounded-md border border-border bg-subtle/40">
                <DataTable className="rounded-none border-0">
                  <DataTableHead>
                    <DataTableRow>
                      <DataTableHeaderCell>Szolgáltatás</DataTableHeaderCell>
                      <DataTableHeaderCell className="text-right">
                        Mennyiség
                      </DataTableHeaderCell>
                      <DataTableHeaderCell className="text-right">
                        Nettó ár
                      </DataTableHeaderCell>
                      <DataTableHeaderCell className="text-right">
                        Bruttó ár
                      </DataTableHeaderCell>
                    </DataTableRow>
                  </DataTableHead>
                  <DataTableBody>
                    {(() => {
                      const totalCuttingGross = quote.material_lines.reduce(
                        (s, l) => s + l.cutting_gross,
                        0
                      )
                      const totalCuttingNet = quote.material_lines.reduce(
                        (s, l) => s + l.cutting_net,
                        0
                      )
                      const totalCuttingLength = quote.material_lines.reduce(
                        (s, l) => s + l.cutting_length_m,
                        0
                      )
                      let totalEdgeLength = 0
                      let totalEdgeNet = 0
                      let totalEdgeGross = 0
                      for (const line of quote.material_lines) {
                        if (line.edge_gross > 0) {
                          totalEdgeGross += line.edge_gross
                          totalEdgeNet += line.edge_net
                          totalEdgeLength += line.edge_length_m
                        }
                      }

                      const rows: React.ReactNode[] = []

                      if (totalCuttingGross > 0) {
                        const unit =
                          totalCuttingLength > 0
                            ? totalCuttingGross / totalCuttingLength
                            : 0
                        const rounded = Math.round(unit * 100) / 100
                        const gross = rounded * totalCuttingLength
                        const net =
                          totalCuttingGross > 0
                            ? totalCuttingNet * (gross / totalCuttingGross)
                            : totalCuttingNet
                        rows.push(
                          <DataTableRow key="cutting">
                            <DataTableCell className="text-ink">
                              Szabás díj
                            </DataTableCell>
                            <DataTableCell className="text-right tabular-nums text-ink">
                              {totalCuttingLength.toFixed(2)} m
                            </DataTableCell>
                            <DataTableCell className="text-right tabular-nums text-ink">
                              {formatQuotePrice(Math.round(net), quote.currency)}
                            </DataTableCell>
                            <DataTableCell className="text-right tabular-nums text-ink">
                              {formatQuotePrice(
                                Math.round(gross),
                                quote.currency
                              )}
                            </DataTableCell>
                          </DataTableRow>
                        )
                      }

                      if (totalEdgeGross > 0) {
                        const unit =
                          totalEdgeLength > 0
                            ? totalEdgeGross / totalEdgeLength
                            : 0
                        const rounded = Math.round(unit * 100) / 100
                        const gross = rounded * totalEdgeLength
                        const net =
                          totalEdgeGross > 0
                            ? totalEdgeNet * (gross / totalEdgeGross)
                            : totalEdgeNet
                        rows.push(
                          <DataTableRow key="edge">
                            <DataTableCell className="text-ink">
                              Élzárás
                            </DataTableCell>
                            <DataTableCell className="text-right tabular-nums text-ink">
                              {totalEdgeLength.toFixed(2)} m
                            </DataTableCell>
                            <DataTableCell className="text-right tabular-nums text-ink">
                              {formatQuotePrice(Math.round(net), quote.currency)}
                            </DataTableCell>
                            <DataTableCell className="text-right tabular-nums text-ink">
                              {formatQuotePrice(
                                Math.round(gross),
                                quote.currency
                              )}
                            </DataTableCell>
                          </DataTableRow>
                        )
                      }

                      if (rows.length === 0) {
                        return (
                          <DataTableRow>
                            <DataTableCell
                              colSpan={4}
                              className="text-center text-ink-secondary"
                            >
                              Nincs szolgáltatási adat.
                            </DataTableCell>
                          </DataTableRow>
                        )
                      }
                      return rows
                    })()}
                  </DataTableBody>
                </DataTable>
              </div>

              {/* 3) Összesítők — main: Lapszabászat + Részösszeg + Végösszeg (díj/termék/kedvezmény nélkül) */}
              <div className="mb-2 space-y-1 rounded-md border border-border bg-subtle/60 px-3 py-2.5">
                <div className="flex justify-between text-body font-semibold text-ink">
                  <span>Lapszabászat:</span>
                  <span className="tabular-nums">
                    {formatQuotePrice(quote.total_gross, quote.currency)}
                  </span>
                </div>
              </div>

              <div className="space-y-2 rounded-md border border-border bg-subtle/40 px-3 py-2.5">
                <div className="flex justify-between text-body font-bold text-ink">
                  <span>Részösszeg:</span>
                  <span className="tabular-nums">
                    {formatQuotePrice(quote.total_gross, quote.currency)}
                  </span>
                </div>
                <div className="border-t border-border pt-2">
                  <div className="flex items-center justify-between rounded-md border border-border bg-subtle px-2.5 py-2 text-body font-bold text-ink">
                    <span>Végösszeg:</span>
                    <span className="tabular-nums">
                      {formatQuotePrice(quote.total_gross, quote.currency)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {quote.comment ? (
            <section className="rounded-lg border border-border bg-surface p-3">
              <h2 className="mb-1 text-h3 text-ink">Megjegyzés</h2>
              <p className="whitespace-pre-wrap text-body text-ink-secondary">
                {quote.comment}
              </p>
            </section>
          ) : null}

          {quote.edge_summary.length > 0 ? (
            <section className="overflow-hidden rounded-lg border border-border bg-surface">
              <header className="border-b border-border bg-subtle px-3 py-2">
                <h2 className="text-h3 text-ink">Élzáró összesítő</h2>
              </header>
              <DataTable>
                <DataTableHead>
                  <DataTableRow>
                    <DataTableHeaderCell>Anyag</DataTableHeaderCell>
                    <DataTableHeaderCell>Élzáró</DataTableHeaderCell>
                    <DataTableHeaderCell className="text-right">
                      Hossz (m)
                    </DataTableHeaderCell>
                  </DataTableRow>
                </DataTableHead>
                <DataTableBody>
                  {quote.edge_summary.map((row, i) => (
                    <DataTableRow
                      key={`${row.material_name}-${row.edge_name}-${i}`}
                    >
                      <DataTableCell className="text-ink">
                        {row.material_name}
                      </DataTableCell>
                      <DataTableCell className="text-ink">
                        {row.edge_name}
                      </DataTableCell>
                      <DataTableCell className="text-right tabular-nums text-ink">
                        {row.length_m.toFixed(2)}
                      </DataTableCell>
                    </DataTableRow>
                  ))}
                </DataTableBody>
              </DataTable>
            </section>
          ) : null}

          <section className="overflow-hidden rounded-lg border border-border bg-surface">
            <header className="border-b border-border bg-subtle px-3 py-2">
              <h2 className="text-h3 text-ink">Szabásjegyzék</h2>
            </header>
            <div className="overflow-x-auto">
              <DataTable>
                <DataTableHead>
                  <DataTableRow>
                    <DataTableHeaderCell>Anyag</DataTableHeaderCell>
                    <DataTableHeaderCell className="text-right">
                      Hosszúság
                    </DataTableHeaderCell>
                    <DataTableHeaderCell className="text-right">
                      Szélesség
                    </DataTableHeaderCell>
                    <DataTableHeaderCell className="text-right">
                      Darab
                    </DataTableHeaderCell>
                    <DataTableHeaderCell>Jelölés</DataTableHeaderCell>
                    <DataTableHeaderCell>Hosszú alsó</DataTableHeaderCell>
                    <DataTableHeaderCell>Hosszú felső</DataTableHeaderCell>
                    <DataTableHeaderCell>Széles bal</DataTableHeaderCell>
                    <DataTableHeaderCell>Széles jobb</DataTableHeaderCell>
                    <DataTableHeaderCell className="text-center">
                      Egyéb
                    </DataTableHeaderCell>
                  </DataTableRow>
                </DataTableHead>
                <DataTableBody>
                  {quote.panels.map((panel) => (
                    <DataTableRow key={panel.id}>
                      <DataTableCell className="text-ink">
                        <span className="font-medium">
                          {panel.material_machine_code || panel.material_name}
                        </span>
                        {panel.material_machine_code ? (
                          <span className="mt-0.5 block text-hint text-ink-secondary">
                            {panel.material_name}
                          </span>
                        ) : null}
                      </DataTableCell>
                      <DataTableCell className="text-right tabular-nums text-ink">
                        {panel.grain_mm}
                      </DataTableCell>
                      <DataTableCell className="text-right tabular-nums text-ink">
                        {panel.cross_mm}
                      </DataTableCell>
                      <DataTableCell className="text-right tabular-nums text-ink">
                        {panel.quantity}
                      </DataTableCell>
                      <DataTableCell className="text-ink-secondary">
                        {panel.label || '—'}
                      </DataTableCell>
                      <DataTableCell className="tabular-nums text-ink">
                        {panel.edge_a_code || ''}
                      </DataTableCell>
                      <DataTableCell className="tabular-nums text-ink">
                        {panel.edge_c_code || ''}
                      </DataTableCell>
                      <DataTableCell className="tabular-nums text-ink">
                        {panel.edge_b_code || ''}
                      </DataTableCell>
                      <DataTableCell className="tabular-nums text-ink">
                        {panel.edge_d_code || ''}
                      </DataTableCell>
                      <DataTableCell className="text-center text-ink-secondary">
                        —
                      </DataTableCell>
                    </DataTableRow>
                  ))}
                </DataTableBody>
              </DataTable>
            </div>
          </section>
        </div>

        {/* Right: actions */}
        <aside className="lg:col-span-3">
          <div className="space-y-3 lg:sticky lg:top-14">
            <section className="rounded-lg border border-border-strong bg-surface p-3 shadow-sm">
              <h2 className="mb-3 text-h3 text-ink">Műveletek</h2>
              <div className="flex flex-col gap-3">
                {isPartner ? (
                  <>
                    {isPartnerDraft ? (
                      <div className="space-y-1.5">
                        <p className="text-label font-semibold text-ink-secondary">
                          Beküldés
                        </p>
                        <Button
                          type="button"
                          variant="primary"
                          className="w-full justify-start"
                          onClick={() => setSubmitOpen(true)}
                        >
                          <Send className="size-3.5" aria-hidden />
                          Beküldés a cégnek
                        </Button>
                      </div>
                    ) : null}

                    <div className="space-y-1.5">
                      <p className="text-label font-semibold text-ink-secondary">
                        Szerkesztés
                      </p>
                      <Button
                        type="button"
                        variant="secondary"
                        className="w-full justify-start"
                        disabled={!canEditInOpti}
                        title={
                          isPartnerSubmitted
                            ? 'A beküldött ajánlatot már nem szerkesztheted'
                            : 'Panelek szerkesztése Optiban'
                        }
                        onClick={() => router.push(optiHref)}
                      >
                        <ScanSearch className="size-3.5" aria-hidden />
                        Opti szerkesztés
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        className="w-full justify-start"
                        disabled={!canEditComment}
                        title={
                          isPartnerSubmitted
                            ? 'Beküldés után a megjegyzés nem szerkeszthető'
                            : undefined
                        }
                        onClick={() => {
                          setCommentDraft(quote.comment ?? '')
                          setCommentOpen(true)
                        }}
                      >
                        <MessageSquare className="size-3.5" aria-hidden />
                        {quote.comment
                          ? 'Megjegyzés szerkesztése'
                          : 'Megjegyzés'}
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        className="w-full justify-start"
                        disabled={!canEditProjectName}
                        title={
                          isPartnerSubmitted
                            ? 'Beküldés után a projekt neve nem szerkeszthető'
                            : undefined
                        }
                        onClick={() => {
                          setProjectDraft(quote.project_name ?? '')
                          setProjectOpen(true)
                        }}
                      >
                        <FolderKanban className="size-3.5" aria-hidden />
                        {quote.project_name
                          ? 'Projekt neve szerkesztése'
                          : 'Projekt neve'}
                      </Button>
                    </div>

                    <div className="space-y-1.5">
                      <p className="text-label font-semibold text-ink-secondary">
                        Dokumentumok
                      </p>
                      <Button
                        type="button"
                        variant={
                          primaryAction === 'pdf' ? 'primary' : 'secondary'
                        }
                        className="w-full justify-start"
                        disabled={isGeneratingPdf}
                        loading={isGeneratingPdf}
                        onClick={handleGeneratePdf}
                      >
                        <FileText className="size-3.5" aria-hidden />
                        {isGeneratingPdf
                          ? 'PDF generálása…'
                          : 'PDF generálás'}
                      </Button>
                    </div>

                    {isPartnerDraft ? (
                      <div className="space-y-1.5">
                        <p className="text-label font-semibold text-ink-secondary">
                          Törlés
                        </p>
                        <Button
                          type="button"
                          variant="ghost"
                          className="w-full justify-start text-danger-ink hover:text-danger-ink"
                          onClick={() => setDeleteOpen(true)}
                        >
                          Ajánlat törlése
                        </Button>
                      </div>
                    ) : null}
                  </>
                ) : (
                  <>
                    {primaryAction === 'order' ||
                    primaryAction === 'payment' ||
                    primaryAction === 'production' ? (
                      <div className="space-y-1.5">
                        <p className="text-label font-semibold text-ink-secondary">
                          {primaryAction === 'order'
                            ? 'Megrendelés'
                            : primaryAction === 'production'
                              ? 'Gyártás'
                              : 'Fizetés'}
                        </p>
                        {primaryAction === 'order' ? (
                          <Button
                            type="button"
                            variant="primary"
                            className="w-full justify-start"
                            disabled={!canWrite || dialogOptionsLoading}
                            loading={dialogOptionsLoading}
                            onClick={() => void openOrderDialog()}
                          >
                            <ShoppingCart className="size-3.5" aria-hidden />
                            Megrendelés létrehozása
                          </Button>
                        ) : primaryAction === 'production' ? (
                          <Button
                            type="button"
                            variant="primary"
                            className="w-full justify-start"
                            disabled={dialogOptionsLoading}
                            loading={dialogOptionsLoading}
                            onClick={() => void openProductionDialog()}
                          >
                            <Factory className="size-3.5" aria-hidden />
                            Gyártásba adás
                          </Button>
                        ) : (
                          <Button
                            type="button"
                            variant="primary"
                            className="w-full justify-start"
                            disabled={dialogOptionsLoading}
                            loading={dialogOptionsLoading}
                            onClick={() => void openPaymentDialog()}
                          >
                            Befizetés rögzítése
                          </Button>
                        )}
                      </div>
                    ) : null}

                    {canAssignProduction && primaryAction !== 'production' ? (
                      <div className="space-y-1.5">
                        <p className="text-label font-semibold text-ink-secondary">
                          Gyártás
                        </p>
                        <Button
                          type="button"
                          variant="secondary"
                          className="w-full justify-start"
                          disabled={dialogOptionsLoading}
                          loading={dialogOptionsLoading}
                          onClick={() => void openProductionDialog()}
                        >
                          <Factory className="size-3.5" aria-hidden />
                          {quote.production_machine_id
                            ? 'Gyártás módosítása'
                            : 'Gyártásba adás'}
                        </Button>
                      </div>
                    ) : null}

                    <div className="space-y-1.5">
                      <p className="text-label font-semibold text-ink-secondary">
                        Szerkesztés
                      </p>
                      <Button
                        type="button"
                        variant={
                          primaryAction === 'opti' ? 'primary' : 'secondary'
                        }
                        className="w-full justify-start"
                        disabled={!canEditInOpti}
                        title={
                          !canWrite
                            ? 'Nincs írási jogod'
                            : !isQuoteEditableInOpti(quote.status)
                              ? 'Csak piszkozat vagy megrendelés szerkeszthető Optiból'
                              : 'Panelek szerkesztése Optiban'
                        }
                        onClick={() => router.push(optiHref)}
                      >
                        <ScanSearch className="size-3.5" aria-hidden />
                        Opti szerkesztés
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        className="w-full justify-start"
                        disabled={!canWrite}
                        onClick={() => {
                          setCommentDraft(quote.comment ?? '')
                          setCommentOpen(true)
                        }}
                      >
                        <MessageSquare className="size-3.5" aria-hidden />
                        {quote.comment
                          ? 'Megjegyzés szerkesztése'
                          : 'Megjegyzés'}
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        className="w-full justify-start"
                        disabled={!canEditProjectName}
                        onClick={() => {
                          setProjectDraft(quote.project_name ?? '')
                          setProjectOpen(true)
                        }}
                      >
                        <FolderKanban className="size-3.5" aria-hidden />
                        {quote.project_name
                          ? 'Projekt neve szerkesztése'
                          : 'Projekt neve'}
                      </Button>
                    </div>

                    <div className="space-y-1.5">
                      <p className="text-label font-semibold text-ink-secondary">
                        Dokumentumok
                      </p>
                      <Button
                        type="button"
                        variant="secondary"
                        className="w-full justify-start"
                        disabled={isExportingExcel || exportTargetsLoading}
                        loading={isExportingExcel || exportTargetsLoading}
                        title={
                          !exportTargetsLoaded
                            ? 'Excel export'
                            : aliveExportTargets.length === 0
                              ? orphanPanelCount > 0
                                ? 'A panelek törölt berendezéshez kötöttek — kösd át az anyagot.'
                                : 'Nincs panel az exportáláshoz.'
                              : aliveExportTargets.length === 1
                                ? `${exportFormatLabel(aliveExportTargets[0].exportFormat)} — ${aliveExportTargets[0].equipmentName}`
                                : 'Válaszd ki, melyik gépre készüljön az Excel.'
                        }
                        onClick={() => void handleExcelClick()}
                      >
                        <FileDown className="size-3.5" aria-hidden />
                        {isExportingExcel || exportTargetsLoading
                          ? 'Excel…'
                          : exportTargetsLoaded &&
                              aliveExportTargets.length === 1
                            ? `Export Excel — ${aliveExportTargets[0].equipmentName}`
                            : 'Export Excel…'}
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        className="w-full justify-start"
                        disabled={isGeneratingPdf}
                        loading={isGeneratingPdf}
                        onClick={handleGeneratePdf}
                      >
                        <FileText className="size-3.5" aria-hidden />
                        {isGeneratingPdf
                          ? 'PDF generálása…'
                          : 'PDF generálás'}
                      </Button>
                    </div>

                    {primaryAction !== 'order' && quote.status === 'draft' ? (
                      <div className="space-y-1.5">
                        <p className="text-label font-semibold text-ink-secondary">
                          Megrendelés
                        </p>
                        <Button
                          type="button"
                          variant="secondary"
                          className="w-full justify-start"
                          disabled
                          title="Nincs írási jogod"
                        >
                          <ShoppingCart className="size-3.5" aria-hidden />
                          Megrendelés
                        </Button>
                      </div>
                    ) : null}
                  </>
                )}
              </div>
            </section>

            <section className="rounded-lg border border-border bg-surface p-3">
              <h2 className="mb-2 text-h3 text-ink">Árajánlat infó</h2>
              <dl className="space-y-1.5 text-body">
                <div>
                  <dt className="text-hint text-ink-secondary">Szám</dt>
                  <dd className="font-medium text-ink">{quote.quote_number}</dd>
                </div>
                {quote.project_name ? (
                  <div>
                    <dt className="text-hint text-ink-secondary">Projekt</dt>
                    <dd className="text-ink">{quote.project_name}</dd>
                  </div>
                ) : null}
                {quote.order_number ? (
                  <div>
                    <dt className="text-hint text-ink-secondary">Megrendelés</dt>
                    <dd className="font-medium text-ink">
                      {quote.order_number}
                    </dd>
                  </div>
                ) : null}
                {!isPartner && quote.production_machine_id ? (
                  <div>
                    <dt className="text-hint text-ink-secondary">Gyártógép</dt>
                    <dd className="text-ink">
                      {quote.production_machine_name ?? '—'}
                    </dd>
                  </div>
                ) : null}
                {quote.production_date ? (
                  <div>
                    <dt className="text-hint text-ink-secondary">
                      Gyártás dátuma
                    </dt>
                    <dd className="text-ink">
                      {new Intl.DateTimeFormat('hu-HU', {
                        dateStyle: 'short'
                      }).format(new Date(quote.production_date))}
                    </dd>
                  </div>
                ) : null}
                {!isPartner && quote.barcode ? (
                  <div>
                    <dt className="text-hint text-ink-secondary">Vonalkód</dt>
                    <dd className="font-mono text-ink">{quote.barcode}</dd>
                  </div>
                ) : null}
                <div>
                  <dt className="text-hint text-ink-secondary">Státusz</dt>
                  <dd>
                    <StatusBadge tone={statusTone}>{statusLabel}</StatusBadge>
                  </dd>
                </div>
                {showPartnerPayment || showStaffPayment ? (
                  <div>
                    <dt className="text-hint text-ink-secondary">Fizetés</dt>
                    <dd>
                      <StatusBadge
                        tone={paymentStatusTone(quote.payment_status)}
                      >
                        {PAYMENT_STATUS_LABEL[quote.payment_status]}
                      </StatusBadge>
                    </dd>
                  </div>
                ) : null}
                <div>
                  <dt className="text-hint text-ink-secondary">Bruttó</dt>
                  <dd className="font-semibold tabular-nums text-ink">
                    {formatQuotePrice(quote.total_gross, quote.currency)}
                  </dd>
                </div>
                {showPartnerPayment || showStaffPayment ? (
                  <div>
                    <dt className="text-hint text-ink-secondary">Fizetve</dt>
                    <dd className="tabular-nums text-ink">
                      {formatQuotePrice(quote.total_paid, quote.currency)}
                      {quote.total_paid < quote.total_gross ? (
                        <span className="ml-1 text-hint text-ink-secondary">
                          / hátralék{' '}
                          {formatQuotePrice(
                            Math.max(0, quote.total_gross - quote.total_paid),
                            quote.currency
                          )}
                        </span>
                      ) : null}
                    </dd>
                  </div>
                ) : null}
                <div>
                  <dt className="text-hint text-ink-secondary">Létrehozva</dt>
                  <dd className="text-ink-secondary">
                    {new Intl.DateTimeFormat('hu-HU', {
                      dateStyle: 'short',
                      timeStyle: 'short'
                    }).format(new Date(quote.created_at))}
                  </dd>
                </div>
              </dl>

              {quote.payments.length > 0 ? (
                <div className="mt-3 border-t border-border pt-2">
                  <h3 className="mb-1.5 text-label font-semibold text-ink">
                    Befizetések
                  </h3>
                  <ul className="space-y-1.5">
                    {quote.payments.map((p) => (
                      <li
                        key={p.id}
                        className="rounded-md border border-border bg-subtle/40 px-2 py-1.5 text-hint"
                      >
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="font-medium text-ink">
                            {p.payment_method_name}
                          </span>
                          <span className="tabular-nums font-semibold text-ink">
                            {formatQuotePrice(p.amount, quote.currency)}
                          </span>
                        </div>
                        <p className="text-ink-secondary">
                          {new Intl.DateTimeFormat('hu-HU', {
                            dateStyle: 'short',
                            timeStyle: 'short'
                          }).format(new Date(p.payment_date))}
                          {!isPartner && p.comment ? ` · ${p.comment}` : ''}
                        </p>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </section>
          </div>
        </aside>
      </div>

      <Dialog open={commentOpen} onOpenChange={setCommentOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Megjegyzés</DialogTitle>
            <DialogDescription>
              {isPartner
                ? 'Megjegyzés az ajánlathoz — a PDF-ben is megjelenik.'
                : 'Belső megjegyzés az árajánlathoz.'}
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={commentDraft}
            onChange={(e) => setCommentDraft(e.target.value)}
            rows={5}
            placeholder="Pl. ügyfél kérése, szállítási megjegyzés…"
            disabled={pending}
          />
          <DialogFooter>
            <Button
              type="button"
              variant="secondary"
              disabled={pending}
              onClick={() => setCommentOpen(false)}
            >
              Mégse
            </Button>
            <Button
              type="button"
              disabled={pending}
              loading={pending}
              onClick={handleSaveComment}
            >
              Megjegyzés mentése
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={projectOpen} onOpenChange={setProjectOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Projekt neve</DialogTitle>
            <DialogDescription>
              Opcionális megnevezés — pl. Konyha – Kovács. Nem jelenik meg a
              PDF-en.
            </DialogDescription>
          </DialogHeader>
          <Input
            value={projectDraft}
            onChange={(e) => setProjectDraft(e.target.value)}
            maxLength={PROJECT_NAME_MAX_LENGTH}
            placeholder="pl. Konyha – Kovács"
            disabled={pending}
          />
          <DialogFooter>
            <Button
              type="button"
              variant="secondary"
              disabled={pending}
              onClick={() => setProjectOpen(false)}
            >
              Mégse
            </Button>
            <Button
              type="button"
              disabled={pending}
              loading={pending}
              onClick={handleSaveProjectName}
            >
              Projekt neve mentése
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={excelPickerOpen}
        onOpenChange={(open) => {
          if (!isExportingExcel) setExcelPickerOpen(open)
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Excel export</DialogTitle>
            <DialogDescription>
              A panelek több géphez tartoznak. Válaszd ki, melyik gépre készüljön
              a fájl.
            </DialogDescription>
          </DialogHeader>

          <fieldset className="space-y-2">
            <legend className="sr-only">Berendezés</legend>
            {aliveExportTargets.map((target) => {
              const selected = selectedEquipmentId === target.equipmentId
              return (
                <label
                  key={target.equipmentId}
                  className={cn(
                    'flex cursor-pointer items-start gap-2.5 rounded-md border px-3 py-2',
                    selected
                      ? 'border-ink bg-subtle'
                      : 'border-border hover:bg-subtle/60'
                  )}
                >
                  <input
                    type="radio"
                    name="excel-equipment"
                    className="mt-1"
                    checked={selected}
                    onChange={() =>
                      setSelectedEquipmentId(target.equipmentId)
                    }
                  />
                  <span className="min-w-0">
                    <span className="block text-body font-medium text-ink">
                      {target.equipmentName}
                    </span>
                    <span className="block text-hint text-ink-secondary">
                      {exportFormatLabel(target.exportFormat)} ·{' '}
                      {target.panelCount} panel
                      {target.missingMachineCodeCount > 0
                        ? ` · ${target.missingMachineCodeCount} hiányzó gépkód`
                        : ''}
                    </span>
                  </span>
                </label>
              )
            })}
          </fieldset>

          <DialogFooter>
            <Button
              type="button"
              variant="secondary"
              disabled={isExportingExcel}
              onClick={() => setExcelPickerOpen(false)}
            >
              Mégse
            </Button>
            <Button
              type="button"
              disabled={!selectedEquipmentId || isExportingExcel}
              loading={isExportingExcel}
              onClick={() => void downloadExcel(selectedEquipmentId)}
            >
              Excel letöltése
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <CreateOrderDialog
        open={orderDialogOpen}
        onOpenChange={setOrderDialogOpen}
        quoteId={quote.id}
        quoteNumber={quote.quote_number}
        totalGross={quote.total_gross}
        currency={quote.currency}
        paymentMethods={paymentMethods}
        onSuccess={() => router.refresh()}
      />

      {quote.order_number ? (
        <AssignProductionDialog
          open={productionDialogOpen}
          onOpenChange={setProductionDialogOpen}
          quoteId={quote.id}
          orderNumber={quote.order_number}
          machines={productionMachines}
          existing={{
            productionMachineId: quote.production_machine_id,
            productionDate: quote.production_date,
            barcode: quote.barcode
          }}
          onSuccess={() => router.refresh()}
        />
      ) : null}

      {quote.order_number ? (
        <AddPaymentDialog
          open={addPaymentOpen}
          onOpenChange={setAddPaymentOpen}
          quoteId={quote.id}
          orderNumber={quote.order_number}
          totalGross={quote.total_gross}
          totalPaid={quote.total_paid}
          currency={quote.currency}
          paymentMethods={paymentMethods}
          onSuccess={() => router.refresh()}
        />
      ) : null}

      {isPartnerDraft ? (
        <>
          <ConfirmDialog
            open={submitOpen}
            onOpenChange={setSubmitOpen}
            title="Ajánlat beküldése"
            description={`Beküldöd a(z) ${quote.quote_number} ajánlatot a cégnek? Utána már nem szerkesztheted.`}
            confirmLabel="Beküldés"
            variant="primary"
            loading={pending}
            onConfirm={handlePartnerSubmit}
          />
          <ConfirmDialog
            open={deleteOpen}
            onOpenChange={setDeleteOpen}
            title="Ajánlat törlése"
            description={`Biztosan törlöd a(z) ${quote.quote_number} ajánlatot?`}
            confirmLabel="Törlés"
            variant="danger"
            loading={pending}
            onConfirm={handlePartnerDelete}
          />
        </>
      ) : null}
    </div>
  )
}
