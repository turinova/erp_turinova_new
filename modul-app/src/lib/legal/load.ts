import { readFileSync } from 'node:fs'
import { join } from 'node:path'

export type LegalDocSlug = 'impresszum' | 'aszf' | 'adatkezeles'

const FILE_BY_SLUG: Record<LegalDocSlug, string> = {
  impresszum: 'impresszum.md',
  aszf: 'aszf.md',
  adatkezeles: 'adatkezeles.md'
}

export function loadLegalMarkdown(slug: LegalDocSlug): string {
  const file = FILE_BY_SLUG[slug]
  const path = join(process.cwd(), 'src/content/legal', file)
  return readFileSync(path, 'utf8')
}
