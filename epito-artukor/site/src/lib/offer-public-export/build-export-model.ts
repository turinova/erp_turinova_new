import type { CustomerPackage, CustomerPackageSnapshot } from "@/types/projects"
import { getTradeLabel } from "@/lib/trades"
import type { QuotePdfModel, QuotePdfSummaryRow, QuotePdfTradeBlock } from "@/lib/project-export/build-quote-pdf-model"
import type { TigParty } from "@/lib/tig-preview-build"

export type OfferPublicProject = {
  name: string
  siteAddress: string
  code: string
  clientName: string
}

export type OfferPublicOrganization = {
  legalName: string
  address: string
  taxNumber: string
  registrationNumber?: string
  email?: string
  phone?: string
  logoDataUrl?: string
  bankLine?: string | null
  contactLine?: string | null
}

export type OfferPublicExportLine = {
  ssz: number
  identifier: string
  text: string
  quantity: number
  unit: string
  materialUnit: number
  laborUnit: number
  materialTotal: number
  laborTotal: number
  netTotal: number
}

export type OfferPublicExportTrade = {
  quoteId: string
  tradeLabel: string
  packageTitle: string
  sellNetTotal: number
  grossTotal: number
  vatLabel: string
  vatAmount: number
  lines: OfferPublicExportLine[]
  hasLineDetail: boolean
}

export type OfferPublicExportModel = {
  title: string
  projectName: string
  projectCode: string
  siteAddress: string
  clientName: string
  notes: string
  sentAt: string
  expiresAt: string | null
  sellNetTotal: number
  grossTotal: number
  trades: OfferPublicExportTrade[]
  organization: OfferPublicOrganization | null
  exportedAt: string
}

function tradeLabel(snap: CustomerPackageSnapshot): string {
  const fromTrade = getTradeLabel(snap.trade)
  if (fromTrade && fromTrade !== String(snap.trade)) return fromTrade
  return snap.quoteTitle?.trim() || fromTrade || "Szakág"
}

function buildTrade(snap: CustomerPackageSnapshot): OfferPublicExportTrade {
  const lines = snap.lines ?? []
  const vatAmount = Math.max(0, Math.round(snap.grossTotal - (snap.sellNetTotal ?? 0)))
  return {
    quoteId: snap.quoteId,
    tradeLabel: tradeLabel(snap),
    packageTitle: snap.quoteTitle,
    sellNetTotal: snap.sellNetTotal ?? 0,
    grossTotal: snap.grossTotal,
    vatLabel: snap.vatLabel ?? "",
    vatAmount,
    hasLineDetail: lines.length > 0,
    lines: lines.map((line, index) => {
      const hasSplit =
        line.sellMaterialUnitPrice != null || line.sellLaborUnitPrice != null
      const materialUnit = hasSplit
        ? (line.sellMaterialUnitPrice ?? 0)
        : line.sellNetUnitPrice
      const laborUnit = hasSplit ? (line.sellLaborUnitPrice ?? 0) : 0
      const materialTotal = hasSplit
        ? (line.sellMaterialTotal ?? Math.round(materialUnit * line.quantity))
        : line.sellNetTotal
      const laborTotal = hasSplit
        ? (line.sellLaborTotal ?? Math.round(laborUnit * line.quantity))
        : 0
      return {
        ssz: index + 1,
        identifier: line.identifier?.trim() || "—",
        text: line.text,
        quantity: line.quantity,
        unit: line.unitLabel,
        materialUnit,
        laborUnit,
        materialTotal,
        laborTotal,
        netTotal: line.sellNetTotal,
      }
    }),
  }
}

export function buildOfferPublicExportModel(input: {
  pkg: CustomerPackage
  project: OfferPublicProject | null
  organization: OfferPublicOrganization | null
}): OfferPublicExportModel {
  const trades = input.pkg.snapshots.map(buildTrade)
  trades.sort((a, b) =>
    a.tradeLabel.localeCompare(b.tradeLabel, "hu", { sensitivity: "base" })
  )

  return {
    title: input.pkg.title,
    projectName: input.project?.name ?? "",
    projectCode: input.project?.code ?? "",
    siteAddress: input.project?.siteAddress ?? "",
    clientName: input.project?.clientName ?? "",
    notes: input.pkg.notes?.trim() || "",
    sentAt: input.pkg.sentAt,
    expiresAt: input.pkg.expiresAt ?? null,
    sellNetTotal: input.pkg.sellNetTotal,
    grossTotal: input.pkg.grossTotal,
    trades,
    organization: input.organization,
    exportedAt: new Date().toISOString(),
  }
}

export function offerPublicExportFilename(model: OfferPublicExportModel): string {
  const safe = (s: string) =>
    s
      .replace(/[^\w\s-áéíóöőúüűÁÉÍÓÖŐÚÜŰ]/g, "")
      .replace(/\s+/g, "_")
      .slice(0, 36)
  const date = new Date().toISOString().split("T")[0]
  const who =
    safe(model.projectCode) ||
    safe(model.projectName) ||
    safe(model.clientName) ||
    "ajanlat"
  return `ajanlat_${who}_${date}.xlsx`
}

export function buildOfferPublicPdfModel(
  model: OfferPublicExportModel
): QuotePdfModel {
  const issuedAt = model.sentAt || model.exportedAt
  const validUntil =
    model.expiresAt ??
    new Date(new Date(issuedAt).getTime() + 30 * 24 * 60 * 60 * 1000).toISOString()
  const validityDays = Math.max(
    1,
    Math.round(
      (new Date(validUntil).getTime() - new Date(issuedAt).getTime()) /
        (24 * 60 * 60 * 1000)
    )
  )

  const org = model.organization
  const contractor: TigParty = {
    name: org?.legalName || "Vállalkozó",
    address: org?.address || "",
    taxNumber: org?.taxNumber || "",
    registrationNumber: org?.registrationNumber,
  }
  const client: TigParty = {
    name: model.clientName || "Megrendelő",
    address: model.siteAddress || "",
    taxNumber: "",
  }

  const summaryRows: QuotePdfSummaryRow[] = model.trades.map((t, i) => ({
    ssz: i + 1,
    tradeLabel: t.tradeLabel,
    netTotal: t.sellNetTotal,
    vatLabel: t.vatLabel || (t.vatAmount > 0 ? "" : "ÁFA-mentes"),
    vatAmount: t.vatAmount,
    grossTotal: t.grossTotal,
  }))

  const trades: QuotePdfTradeBlock[] = model.trades.map((t) => ({
    tradeLabel: t.tradeLabel,
    sellNetTotal: t.sellNetTotal,
    lines: t.lines.map((l) => ({
      ssz: String(l.ssz),
      identifier: l.identifier,
      text: l.text,
      quantity: l.quantity,
      unitLabel: l.unit,
      sellNetUnitPrice:
        l.quantity > 0
          ? Math.round(l.netTotal / l.quantity)
          : l.materialUnit + l.laborUnit,
      sellNetTotal: l.netTotal,
    })),
  }))

  const vatAmount = Math.max(0, Math.round(model.grossTotal - model.sellNetTotal))

  return {
    issuedAt,
    validUntil,
    validityDays,
    projectName: model.projectName || model.title,
    projectCode: model.projectCode || "—",
    performanceLocation: model.siteAddress || "—",
    client,
    contractor,
    summaryRows,
    trades,
    sellNetTotal: model.sellNetTotal,
    vatAmount,
    grossTotal: model.grossTotal,
    vatNote: model.notes || null,
    showVatAmount: vatAmount > 0,
    paymentTerms: "",
    offerNotes: model.notes,
    logoDataUrl: org?.logoDataUrl,
    contractorBankLine: org?.bankLine ?? null,
    contractorContactLine: org?.contactLine ?? null,
  }
}

export function offerStatusSentence(input: {
  status: CustomerPackage["status"]
  expired: boolean
  expiresAt: string | null
  grossTotal: number
  respondedAt?: string
  respondedByName?: string
}): string {
  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString("hu-HU", {
      year: "numeric",
      month: "short",
      day: "numeric",
    })
  const formatMoney = (n: number) =>
    new Intl.NumberFormat("hu-HU", {
      style: "currency",
      currency: "HUF",
      maximumFractionDigits: 0,
    }).format(n)

  if (input.status === "accepted") {
    const when = input.respondedAt ? formatDate(input.respondedAt) : ""
    const who = input.respondedByName ? ` · ${input.respondedByName}` : ""
    return when ? `Elfogadva ${when}${who}` : `Elfogadva${who}`
  }
  if (input.status === "rejected") {
    const when = input.respondedAt ? formatDate(input.respondedAt) : ""
    return when ? `Elutasítva ${when}` : "Elutasítva"
  }
  if (input.status === "superseded") {
    return "Ezt az ajánlatot egy újabb verzió váltotta fel"
  }
  if (input.expired) {
    return "Az ajánlat érvényessége lejárt — kérjen frissített ajánlatot"
  }
  if (input.status === "sent") {
    const until = input.expiresAt
      ? ` · érvényes ${formatDate(input.expiresAt)}-ig`
      : ""
    return `Döntésre vár${until} · ${formatMoney(input.grossTotal)} bruttó`
  }
  return CUSTOMER_STATUS_FALLBACK[input.status] ?? "Ajánlat"
}

const CUSTOMER_STATUS_FALLBACK: Partial<Record<CustomerPackage["status"], string>> = {
  draft: "Piszkozat",
  sent: "Elküldve",
  accepted: "Elfogadva",
  rejected: "Elutasítva",
  superseded: "Felülírva",
}
