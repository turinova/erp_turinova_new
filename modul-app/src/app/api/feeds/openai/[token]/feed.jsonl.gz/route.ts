import { serveOpenAiFeedJsonlGz } from '@/lib/feeds/openai/serve'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  return serveOpenAiFeedJsonlGz(token)
}
