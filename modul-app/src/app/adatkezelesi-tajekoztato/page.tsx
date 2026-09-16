import type { Metadata } from 'next'

import {
  LegalShell,
  renderLegalMarkdown
} from '@/components/legal/legal-shell'
import { loadLegalMarkdown } from '@/lib/legal/load'

export const metadata: Metadata = {
  title: 'Adatkezelési tájékoztató',
  description: 'Optinova adatkezelési tájékoztató.',
  robots: { index: true, follow: true }
}

export default function AdatkezelesPage() {
  const md = loadLegalMarkdown('adatkezeles')
  return (
    <LegalShell activeHref="/adatkezelesi-tajekoztato">
      {renderLegalMarkdown(md)}
    </LegalShell>
  )
}
