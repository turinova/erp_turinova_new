import { NextResponse } from 'next/server'

/** Régi URL → OpenAI a .jsonl.gz formátumot kéri. */
export async function GET(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const url = new URL(req.url)
  url.pathname = `/api/feeds/openai/${token}/feed.jsonl.gz`
  return NextResponse.redirect(url, 308)
}
