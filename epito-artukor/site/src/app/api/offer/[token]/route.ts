import { NextResponse } from "next/server"
import type { CustomerPackage, Project } from "@/types/projects"
import type { CustomerPackageResponseType } from "@/lib/customer-package"
import { applyCustomerPackageResponse } from "@/lib/customer-package-response"
import { loadBundleFromDb, syncBundleToDb } from "@/lib/server/projects-bundle-db"
import { createSupabaseServiceClient } from "@/lib/supabase/service"
import { clearPinFailures, isPinLocked, recordPinFailure } from "@/lib/server/pin-lockout"

/**
 * Publikus ügyfél-ajánlat végpont — service-role kliens + szerveroldali PIN.
 * Az access_code SOHA nem kerül a válaszba; a feloldás a ?code= paraméterrel
 * (GET) vagy a body accessCode mezőjével (POST) történik, szerveren validálva.
 */

type RouteParams = { params: Promise<{ token: string }> }

type PackageRow = {
  id: string
  project_id: string
  status: string
  access_code: string | null
  expires_at: string | null
}

async function findPackageOrg(
  token: string
): Promise<{ row: PackageRow; orgId: string } | null> {
  const supabase = createSupabaseServiceClient()
  const { data: pkg } = await supabase
    .from("customer_packages")
    .select("id, project_id, status, access_code, expires_at")
    .eq("access_token", token)
    .maybeSingle<PackageRow>()
  if (!pkg) return null

  const { data: project } = await supabase
    .from("projects")
    .select("organization_id")
    .eq("id", pkg.project_id)
    .maybeSingle<{ organization_id: string }>()
  if (!project) return null

  return { row: pkg, orgId: project.organization_id }
}

function sanitizePackage(pkg: CustomerPackage): Omit<CustomerPackage, "accessCode"> {
  const { accessCode: _c, ...rest } = pkg
  return rest
}

export async function GET(request: Request, { params }: RouteParams) {
  const { token } = await params

  try {
    const found = await findPackageOrg(token)
    if (!found) return NextResponse.json({ error: "Not found" }, { status: 404 })

    const url = new URL(request.url)
    const code = url.searchParams.get("code")?.trim() ?? ""
    const needsCode = Boolean(found.row.access_code)
    const codeValid = !needsCode || (code !== "" && code === found.row.access_code)

    if (needsCode && !codeValid) {
      if (code !== "") {
        if (isPinLocked(token)) {
          return NextResponse.json({ error: "Túl sok hibás kód — próbáld 15 perc múlva." }, { status: 429 })
        }
        recordPinFailure(token)
        return NextResponse.json({ error: "Hibás belépőkód" }, { status: 403 })
      }
      // Kód nélkül: minimális információ az űrlaphoz
      return NextResponse.json({
        needsCode: true,
        status: found.row.status,
        expiresAt: found.row.expires_at,
      })
    }

    clearPinFailures(token)

    const supabase = createSupabaseServiceClient()
    const bundle = await loadBundleFromDb(supabase, found.orgId)
    const pkg = bundle.customerPackages.find((p) => p.id === found.row.id)
    if (!pkg) return NextResponse.json({ error: "Not found" }, { status: 404 })

    const project: Project | null =
      bundle.projects.find((p) => p.id === pkg.projectId) ?? null

    return NextResponse.json({
      package: sanitizePackage(pkg),
      project,
    })
  } catch (error) {
    console.error("offer GET:", error)
    return NextResponse.json({ error: "Szerverhiba" }, { status: 500 })
  }
}

export async function POST(request: Request, { params }: RouteParams) {
  const { token } = await params

  try {
    const found = await findPackageOrg(token)
    if (!found) return NextResponse.json({ error: "Not found" }, { status: 404 })

    if (found.row.status === "superseded") {
      return NextResponse.json({ error: "Superseded" }, { status: 410 })
    }

    const body = (await request.json()) as {
      accessCode?: string
      type: CustomerPackageResponseType
      acceptedQuoteIds?: string[]
      clientNotes?: string
      respondedByName?: string
      confirm?: boolean
    }

    if (found.row.access_code) {
      if (isPinLocked(token)) {
        return NextResponse.json({ error: "Túl sok hibás kód — próbáld 15 perc múlva." }, { status: 429 })
      }
      if (!body.accessCode || body.accessCode.trim() !== found.row.access_code) {
        recordPinFailure(token)
        return NextResponse.json({ error: "Invalid code" }, { status: 403 })
      }
      clearPinFailures(token)
    }

    if (!body.confirm) {
      return NextResponse.json({ error: "Confirmation required" }, { status: 400 })
    }

    const supabase = createSupabaseServiceClient()
    const bundle = await loadBundleFromDb(supabase, found.orgId)

    const result = applyCustomerPackageResponse(bundle, found.row.id, {
      type: body.type,
      acceptedQuoteIds: body.acceptedQuoteIds,
      clientNotes: body.clientNotes,
      respondedByName: body.respondedByName,
      viaLink: true,
    })

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }

    const actionLabel =
      body.type === "reject_all"
        ? "Ügyfél elutasította az ajánlatot (linken)"
        : body.type === "partial"
          ? `Részleges elfogadás linken (${result.pkg.acceptedSnapshots?.length ?? 0} szakág)`
          : "Ügyfél elfogadta az ajánlatot (linken)"

    bundle.auditLog = bundle.auditLog ?? []
    bundle.auditLog.unshift({
      id: crypto.randomUUID(),
      projectId: result.pkg.projectId,
      actorUserId: "",
      actorEmail: "",
      actorName: body.respondedByName?.trim() || "Ügyfél",
      kind: "decision",
      action: actionLabel,
      context: body.clientNotes ?? result.pkg.title,
      at: new Date().toISOString(),
    })

    await syncBundleToDb(supabase, found.orgId, bundle)

    return NextResponse.json({ package: sanitizePackage(result.pkg) })
  } catch (error) {
    console.error("offer POST:", error)
    return NextResponse.json({ error: "Szerverhiba" }, { status: 500 })
  }
}
