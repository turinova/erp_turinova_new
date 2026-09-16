import type { Metadata } from 'next'

import {
  LegalShell,
  renderLegalMarkdown
} from '@/components/legal/legal-shell'
import { loadLegalMarkdown } from '@/lib/legal/load'

export const metadata: Metadata = {
  title: 'Impresszum',
  description: 'Optinova impresszum — HÍRÖS-ABLAK Kft.',
  robots: { index: true, follow: true }
}

export default function ImpresszumPage() {
  const md = loadLegalMarkdown('impresszum')
  return (
    <LegalShell activeHref="/impresszum">
      {renderLegalMarkdown(md)}
    </LegalShell>
  )
}
