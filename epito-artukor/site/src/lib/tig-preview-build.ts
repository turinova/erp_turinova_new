import type {
  CustomerPackageSnapshotLine,
  PerformanceCertificate,
  PerformanceCertificateLine,
  Project,
  Quote,
  QuoteLine,
} from "@/types/projects"
import { unitMap } from "@/lib/data/units-store"
import { calcQuoteVatTotals, resolveQuoteVatMode } from "@/lib/quote-client-summary"
import {
  getOrganizationProfile,
  organizationBankLine,
  organizationContactLine,
  organizationToContractorParty,
} from "@/lib/organization-profile"
import { getTigDocumentPrefix } from "@/lib/app-settings"
import { getTradeLabel } from "@/lib/trades"

export type TigParty = {
  name: string
  address: string
  taxNumber: string
  registrationNumber?: string
  representative?: string
}

export type TigPreviewModel = {
  documentNumber: string
  issuedAt: string
  periodFrom?: string
  periodTo: string
  performanceLocation: string
  contractReference: string
  contractPackageId?: string
  contractPackageTitle?: string
  quoteTitle: string
  projectName: string
  projectCode: string
  client: TigParty
  contractor: TigParty
  lines: PerformanceCertificateLine[]
  sellNetTotal: number
  vatMode: PerformanceCertificate["vatMode"]
  vatLabel: string
  vatAmount: number
  grossTotal: number
  vatNote: string | null
  showVatAmount: boolean
  notes?: string
  logoDataUrl?: string
  contractorBankLine?: string | null
  contractorContactLine?: string | null
}

export function demoClientParty(project: Project): TigParty {
  return {
    name: project.clientName,
    address: project.siteAddress || "—",
    taxNumber: "—",
    representative: "—",
  }
}

export function formatTigDocumentNumber(project: Project, seq: number, issuedAt?: string): string {
  const prefix = getTigDocumentPrefix()
  const year = (issuedAt ? new Date(issuedAt) : new Date()).getFullYear()
  return `${prefix}-${project.code}-${year}-${String(seq).padStart(3, "0")}`
}

function buildCertificateLine(
  line: QuoteLine,
  quote: Quote,
  contractedMap: Map<string, CustomerPackageSnapshotLine>
): PerformanceCertificateLine {
  const snap = contractedMap.get(line.id)
  const sellNetUnitPrice = snap?.sellNetUnitPrice ?? 0
  const sellNetTotal = snap?.sellNetTotal ?? 0
  const unitLabel = snap?.unitLabel ?? unitMap[line.unitId]?.code ?? "db"

  return {
    lineId: line.id,
    quoteId: quote.id,
    quoteTitle: quote.title,
    trade: line.trade,
    identifier: snap?.identifier ?? line.identifierSnapshot,
    text: snap?.text ?? line.textSnapshot,
    unitLabel,
    quantity: snap?.quantity ?? line.quantity,
    sellNetUnitPrice,
    sellNetTotal,
  }
}

export type BuildTigPreviewDataInput = {
  project: Project
  quote: Quote
  selectedLines: QuoteLine[]
  contractedMap: Map<string, CustomerPackageSnapshotLine>
  contractReference: string
  contractPackageId?: string
  contractPackageTitle?: string
  documentNumber: string
  issuedAt: string
  periodTo: string
  periodFrom?: string
  notes?: string
}

export function buildTigPreviewModel(input: BuildTigPreviewDataInput): TigPreviewModel {
  const certLines = [...input.selectedLines]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((line) => buildCertificateLine(line, input.quote, input.contractedMap))

  const sellNetTotal = certLines.reduce((sum, l) => sum + l.sellNetTotal, 0)
  const vatMode = resolveQuoteVatMode(input.quote)
  const vat = calcQuoteVatTotals(sellNetTotal, vatMode)
  const orgProfile = organizationToContractorParty()

  return {
    documentNumber: input.documentNumber,
    issuedAt: input.issuedAt,
    periodFrom: input.periodFrom,
    periodTo: input.periodTo,
    performanceLocation: input.project.siteAddress,
    contractReference: input.contractReference,
    contractPackageId: input.contractPackageId,
    contractPackageTitle: input.contractPackageTitle,
    quoteTitle: input.quote.title,
    projectName: input.project.name,
    projectCode: input.project.code,
    client: demoClientParty(input.project),
    contractor: orgProfile,
    lines: certLines,
    sellNetTotal: vat.netTotal,
    vatMode,
    vatLabel: vat.vatLabel,
    vatAmount: vat.vatAmount,
    grossTotal: vat.grossTotal,
    vatNote: vat.vatNote,
    showVatAmount: vat.showVatAmount,
    notes: input.notes,
    logoDataUrl: getOrganizationProfile().logoDataUrl,
    contractorBankLine: organizationBankLine(),
    contractorContactLine: organizationContactLine(),
  }
}

export function tigPreviewToCertificate(
  preview: TigPreviewModel,
  projectId: string
): PerformanceCertificate {
  return {
    id: "",
    projectId,
    documentNumber: preview.documentNumber,
    issuedAt: preview.issuedAt,
    contractPackageId: preview.contractPackageId,
    contractPackageTitle: preview.contractPackageTitle,
    periodFrom: preview.periodFrom,
    periodTo: preview.periodTo,
    performanceLocation: preview.performanceLocation,
    lines: preview.lines,
    sellNetTotal: preview.sellNetTotal,
    grossTotal: preview.grossTotal,
    vatMode: preview.vatMode,
    vatLabel: preview.vatLabel,
    vatAmount: preview.vatAmount,
    notes: preview.notes,
    createdAt: new Date().toISOString(),
  }
}

export function formatTigDate(iso: string): string {
  return new Date(iso).toLocaleDateString("hu-HU", {
    year: "numeric",
    month: "long",
    day: "numeric",
  })
}

export function tigTradeSummary(lines: PerformanceCertificateLine[]): string {
  const trades = [...new Set(lines.map((l) => l.trade))]
  return trades.map((t) => getTradeLabel(t)).join(", ")
}
