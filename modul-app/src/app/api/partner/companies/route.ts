import { NextResponse } from 'next/server'

import { listPartnerAcceptingCompanies } from '@/lib/partner/companies'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const companies = await listPartnerAcceptingCompanies()
    return NextResponse.json({ companies })
  } catch (e) {
    console.error('GET /api/partner/companies', e)
    return NextResponse.json(
      { error: 'A céglista most nem elérhető.', companies: [] },
      { status: 500 }
    )
  }
}
