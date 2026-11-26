import { NextResponse, type NextRequest } from 'next/server'

import {
  JELENLET_PI_AGENT_SCRIPT,
  JELENLET_PI_AGENT_SHA256
} from '@/lib/jelenlet/pi-agent-script.generated'
import { requireJelenletDevice } from '@/lib/jelenlet/terminal-device'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/** Pi v2 telepítő letöltése eszköztokennel (Pi Connect shellből curl). */
export async function GET(request: NextRequest) {
  const ctx = await requireJelenletDevice(request)
  if (ctx instanceof NextResponse) return ctx

  return new NextResponse(JELENLET_PI_AGENT_SCRIPT, {
    status: 200,
    headers: {
      'Content-Type': 'text/x-shellscript; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Agent-Sha256': JELENLET_PI_AGENT_SHA256
    }
  })
}
