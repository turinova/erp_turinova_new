import { NextResponse } from 'next/server'

import { getTenantCompany } from '@/lib/company/queries'
import { computeSheetsForEmployees } from '@/lib/jelenlet/sheet-data'
import { parseSheetRequest } from '@/lib/jelenlet/sheet-request'
import { companyToSheetPdf, generateSheetHtml } from '@/lib/jelenlet/sheet-template'

export const runtime = 'nodejs'

export type SheetPreviewEmployee = {
  id: string
  name: string
  typeName: string
  totalMinutes: number
  overtimeMinutes: number
  daysWorked: number
  absentDays: number
  saturdayDays: number
  warnings: { date: string | null; message: string }[]
}

export type SheetPreviewResponse = {
  employees: SheetPreviewEmployee[]
  missingCount: number
  html: string | null
}

export async function POST(request: Request) {
  const ctx = await parseSheetRequest(request)
  if (!ctx.ok) return NextResponse.json({ error: ctx.error }, { status: ctx.status })

  try {
    const { body } = ctx
    const [{ results, missingIds }, company] = await Promise.all([
      computeSheetsForEmployees(ctx.supabase, {
        tenantId: ctx.tenantId,
        employeeIds: body.employeeIds,
        year: body.year,
        month: body.month,
        rules: body.rules
      }),
      body.previewEmployeeId
        ? getTenantCompany(ctx.supabase, ctx.tenantId)
        : Promise.resolve(null)
    ])

    const previewTarget = body.previewEmployeeId
      ? results.find((r) => r.employee.id === body.previewEmployeeId)
      : null

    const payload: SheetPreviewResponse = {
      employees: results.map(({ employee, result }) => ({
        id: employee.id,
        name: employee.name,
        typeName: employee.typeName,
        totalMinutes: result.summary.totalMinutes,
        overtimeMinutes: result.summary.overtimeMinutes,
        daysWorked: result.summary.daysWorked,
        absentDays: result.summary.absentDays,
        saturdayDays: result.summary.saturdayDays,
        warnings: result.warnings
      })),
      missingCount: missingIds.length,
      html: previewTarget
        ? generateSheetHtml({
            company: companyToSheetPdf(company),
            employee: previewTarget.employee,
            year: body.year,
            month: body.month,
            result: previewTarget.result,
            rules: body.rules,
            presetName: body.presetName
          })
        : null
    }
    return NextResponse.json(payload)
  } catch (error) {
    console.error('jelenlet iv preview', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Előnézet sikertelen.' },
      { status: 500 }
    )
  }
}
