import type {
  RfqInvitation,
  SubcontractorRfq,
  SubcontractorRfqSubmission,
} from "@/types/projects"
import { getBidLineTotal } from "@/lib/rfq-migration"
import { getTradeLabel } from "@/lib/trades"

export type RfqPublicExportMode = "template" | "offer"

export type RfqPublicExportProject = {
  name: string
  siteAddress?: string
  code?: string
}

export type RfqPublicExportLine = {
  ssz: number
  text: string
  quantity: number
  unit: string
  materialUnit: number | null
  laborUnit: number | null
  materialTotal: number | null
  laborTotal: number | null
  lineTotal: number | null
  declined: boolean
}

export type RfqPublicExportPackage = {
  packageId: string
  tradeLabel: string
  packageTitle: string
  expiresAt: string
  /** Kitöltött ajánlat ehhez a csomaghoz? */
  hasSubmission: boolean
  totalAmount: number | null
  lines: RfqPublicExportLine[]
}

export type RfqPublicExportModel = {
  mode: RfqPublicExportMode
  title: string
  partnerName: string
  contactPhone: string
  contactEmail: string
  notes: string
  projectName: string
  siteAddress: string
  projectCode: string
  /** Elsődleges (aktuális link) csomag — PDF / kompatibilitás */
  packageTitle: string
  expiresAt: string
  submittedAt: string | null
  updatedAt: string | null
  totalAmount: number | null
  lines: RfqPublicExportLine[]
  /** Összes exportálandó szakág (legalább 1) */
  packages: RfqPublicExportPackage[]
  exportedAt: string
}

export type RfqPublicExportPackageInput = {
  rfq: SubcontractorRfq
  submission: SubcontractorRfqSubmission | null
  isCurrent?: boolean
}

export function resolveRfqPublicExportMode(
  submission: SubcontractorRfqSubmission | null
): RfqPublicExportMode {
  return submission ? "offer" : "template"
}

function buildPackageLines(
  rfq: SubcontractorRfq,
  submission: SubcontractorRfqSubmission | null,
  units: Record<string, string>,
  fillPrices: boolean
): RfqPublicExportLine[] {
  return rfq.lines.map((line, index) => {
    const bid = submission?.lineBids.find((b) => b.rfqLineId === line.id)
    const declined = bid?.declined ?? false
    if (!fillPrices || !bid || declined) {
      return {
        ssz: index + 1,
        text: line.text,
        quantity: line.quantity,
        unit: units[line.unitId] ?? "",
        materialUnit: fillPrices && declined ? null : fillPrices ? 0 : null,
        laborUnit: fillPrices && declined ? null : fillPrices ? 0 : null,
        materialTotal: null,
        laborTotal: null,
        lineTotal: null,
        declined: fillPrices ? declined : false,
      }
    }
    const materialUnit = bid.materialUnitPrice ?? 0
    const laborUnit = bid.laborUnitPrice ?? bid.unitPrice ?? 0
    return {
      ssz: index + 1,
      text: line.text,
      quantity: line.quantity,
      unit: units[line.unitId] ?? "",
      materialUnit,
      laborUnit,
      materialTotal: Math.round(materialUnit * line.quantity),
      laborTotal: Math.round(laborUnit * line.quantity),
      lineTotal: getBidLineTotal(bid, line.quantity),
      declined: false,
    }
  })
}

function packageTradeLabel(rfq: SubcontractorRfq): string {
  const fromTrade = getTradeLabel(rfq.trade)
  if (fromTrade && fromTrade !== String(rfq.trade)) return fromTrade
  return rfq.title?.trim() || fromTrade || "Szakág"
}

export function buildRfqPublicExportModel(input: {
  /** Aktuális meghívó (a megnyitott link) */
  invitation: RfqInvitation
  project: RfqPublicExportProject | null
  /** Aktuális csomag submission — mode meghatározásához */
  submission: SubcontractorRfqSubmission | null
  units: Record<string, string>
  packages: RfqPublicExportPackageInput[]
  mode?: RfqPublicExportMode
}): RfqPublicExportModel {
  const mode =
    input.mode ??
    (input.packages.some((p) => p.submission != null) || input.submission
      ? "offer"
      : "template")
  const current =
    input.packages.find((p) => p.isCurrent) ??
    input.packages[0]

  if (!current) {
    throw new Error("Nincs exportálható csomag")
  }

  const builtPackages: RfqPublicExportPackage[] = input.packages.map((pkg) => {
    const fillPrices = mode === "offer" && pkg.submission != null
    return {
      packageId: pkg.rfq.id,
      tradeLabel: packageTradeLabel(pkg.rfq),
      packageTitle: pkg.rfq.title,
      expiresAt: pkg.rfq.expiresAt,
      hasSubmission: pkg.submission != null,
      totalAmount: pkg.submission?.totalAmount ?? null,
      lines: buildPackageLines(pkg.rfq, pkg.submission, input.units, fillPrices),
    }
  })

  // Stabil sorrend: szakág név szerint
  builtPackages.sort((a, b) =>
    a.tradeLabel.localeCompare(b.tradeLabel, "hu", { sensitivity: "base" })
  )

  const primary =
    builtPackages.find((p) => p.packageId === current.rfq.id) ?? builtPackages[0]

  const primarySubmission =
    input.packages.find((p) => p.rfq.id === primary.packageId)?.submission ?? null

  const anySubmission =
    input.packages.map((p) => p.submission).find((s) => s != null) ??
    input.submission

  const grandTotal =
    mode === "offer"
      ? builtPackages.reduce((sum, p) => sum + (p.totalAmount ?? 0), 0)
      : null

  const multi = builtPackages.length > 1

  return {
    mode,
    title: mode === "offer" ? "Alvállalkozói ajánlat" : "Árajánlatkérés",
    partnerName:
      anySubmission?.subcontractorName?.trim() ||
      input.invitation.subcontractorName ||
      "",
    contactPhone:
      anySubmission?.contactPhone?.trim() ||
      input.invitation.contactPhone ||
      "",
    contactEmail: anySubmission?.contactEmail?.trim() || "",
    notes:
      builtPackages.length === 1
        ? primarySubmission?.notes?.trim() || input.submission?.notes?.trim() || ""
        : "",
    projectName: input.project?.name ?? "",
    siteAddress: input.project?.siteAddress ?? "",
    projectCode: input.project?.code ?? "",
    packageTitle: multi
      ? `${builtPackages.length} szakág`
      : primary.packageTitle,
    expiresAt: primary.expiresAt,
    submittedAt: primarySubmission?.submittedAt ?? null,
    updatedAt: primarySubmission?.updatedAt ?? null,
    totalAmount: multi ? grandTotal : primary.totalAmount,
    lines: primary.lines,
    packages: builtPackages,
    exportedAt: new Date().toISOString(),
  }
}

export function rfqPublicExportFilename(model: RfqPublicExportModel): string {
  const safe = (s: string) =>
    s
      .replace(/[^\w\s-áéíóöőúüűÁÉÍÓÖŐÚÜŰ]/g, "")
      .replace(/\s+/g, "_")
      .slice(0, 36)
  const date = new Date().toISOString().split("T")[0]
  const prefix = model.mode === "offer" ? "ajanlat" : "ajanlatkeres"
  const who =
    safe(model.partnerName) ||
    safe(model.projectCode) ||
    safe(model.projectName) ||
    "rfq"
  return `${prefix}_${who}_${date}.xlsx`
}

/** Partner-egyezés: ugyanaz a törzs-id, vagy név + telefon. */
export function isSameRfqPartner(
  a: Pick<RfqInvitation, "subcontractorId" | "subcontractorName" | "contactPhone">,
  b: Pick<RfqInvitation, "subcontractorId" | "subcontractorName" | "contactPhone">
): boolean {
  if (a.subcontractorId && b.subcontractorId) {
    return a.subcontractorId === b.subcontractorId
  }
  const normName = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ")
  const digits = (s: string) => s.replace(/\D/g, "")
  const phoneA = digits(a.contactPhone)
  const phoneB = digits(b.contactPhone)
  if (!phoneA || !phoneB || phoneA !== phoneB) return false
  return normName(a.subcontractorName) === normName(b.subcontractorName)
}
