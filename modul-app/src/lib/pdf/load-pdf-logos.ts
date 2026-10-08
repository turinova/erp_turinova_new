import { readFile } from 'fs/promises'
import { join } from 'path'

export type PdfLogos = {
  tenantCompanyLogoBase64: string
  turinovaLogoBase64: string
}

/** Load tenant + Turinova logos as base64 for PDF embedding (same as lapszabászat route). */
export async function loadPdfLogos(
  logoUrl: string | null | undefined
): Promise<PdfLogos> {
  const [tenantCompanyLogoBase64, turinovaLogoBase64] = await Promise.all([
    logoUrl
      ? fetch(logoUrl)
          .then((res) => {
            if (!res.ok) return ''
            return res
              .arrayBuffer()
              .then((buf) => Buffer.from(buf).toString('base64'))
          })
          .catch(() => {
            console.warn('Could not load tenant company logo')
            return ''
          })
      : Promise.resolve(''),
    readFile(join(process.cwd(), 'public', 'images', 'turinova-logo.png'))
      .then((buf) => buf.toString('base64'))
      .catch(() => {
        console.warn('Could not load Turinova logo file')
        return ''
      })
  ])

  return { tenantCompanyLogoBase64, turinovaLogoBase64 }
}
