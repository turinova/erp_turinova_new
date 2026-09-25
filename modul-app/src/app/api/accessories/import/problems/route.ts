import { NextRequest, NextResponse } from 'next/server'

import { buildAccessoriesProblemsWorkbook } from '@/lib/accessories/excel-workbook'
import { parseFailed, planUpload, serverError, XLSX_TYPE } from '@/lib/accessories/import-route'

export const maxDuration = 60

export async function POST(request: NextRequest) {
  try {
    const planned = await planUpload(request)
    if (!planned.ok) return planned.response
    const { workbook, plan, form } = planned.value

    const problems = new Map(plan.problems)
    for (const f of parseFailed(form)) {
      problems.set(f.rowNumber, [...(problems.get(f.rowNumber) ?? []), `Mentés: ${f.message}`])
    }
    if (problems.size === 0) {
      return NextResponse.json({ error: 'Nincs hibás sor.' }, { status: 400 })
    }
    const buffer = await buildAccessoriesProblemsWorkbook(workbook, problems)
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': XLSX_TYPE,
        'Content-Disposition': `attachment; filename="termekek_hibas_sorok_${new Date().toISOString().slice(0, 10)}.xlsx"`
      }
    })
  } catch (err) {
    return serverError('accessories import problems', err, 'A hibás sorok letöltése nem sikerült.')
  }
}
