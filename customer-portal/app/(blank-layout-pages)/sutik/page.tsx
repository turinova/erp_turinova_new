import type { Metadata } from 'next'
import { LegalShell, renderLegalMarkdown } from '@/components/legal/LegalShell'
import { loadLegalMarkdown } from '@/lib/legal/load'

export const metadata: Metadata = {
  title: 'Süti (Cookie) szabályzat',
  description: 'Turinova süti (cookie) szabályzat.',
  robots: { index: true, follow: true },
}

export default function SutikPage() {
  const md = loadLegalMarkdown('sutik')
  return <LegalShell activeHref="/sutik">{renderLegalMarkdown(md)}</LegalShell>
}
