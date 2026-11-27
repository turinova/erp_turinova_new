import { NextResponse, type NextRequest } from 'next/server'

import {
  JELENLET_PI_AGENT_SCRIPT,
  JELENLET_PI_AGENT_SHA256,
  JELENLET_PI_AGENT_V3_SCRIPT,
  JELENLET_PI_AGENT_V3_SHA256
} from '@/lib/jelenlet/pi-agent-script.generated'
import { requireJelenletDevice } from '@/lib/jelenlet/terminal-device'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/** Pi telepítő letöltése eszköztokennel (Pi Connect shellből curl). `?v=3` → local-first frissítés. */
export async function GET(request: NextRequest) {
  const ctx = await requireJelenletDevice(request)
  if (ctx instanceof NextResponse) return ctx

  const v3 = request.nextUrl.searchParams.get('v') === '3'
  return new NextResponse(v3 ? JELENLET_PI_AGENT_V3_SCRIPT : JELENLET_PI_AGENT_SCRIPT, {
    status: 200,
    headers: {
      'Content-Type': 'text/x-shellscript; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Agent-Sha256': v3 ? JELENLET_PI_AGENT_V3_SHA256 : JELENLET_PI_AGENT_SHA256
    }
  })
}
