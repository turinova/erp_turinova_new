export type OrderTextLine = {
  supplierId?: string | null
  supplierName: string | null
  name: string
  sku: string | null
  /** Beszállítói cikkszám (accessory_suppliers) — a szövegben ez szerepel, ha van. */
  supplierSku?: string | null
  qty: number
  unitShortform: string
  shopUrl?: string | null
}

export type OrderTextSupplier = {
  email: string | null
  phone: string | null
  /** suppliers.email_po_intro_html — sima szöveggé alakítva kerül a levél elejére. */
  intro: string | null
  preferred: 'email' | 'internet' | 'phone' | 'in_person' | null
}

export type OrderTextIntroSource = 'supplier' | 'company' | 'default'

export type OrderTextBlock = {
  supplierId: string | null
  supplierName: string
  /** Honnan jön a levél eleje: beszállító sablonja, cég alap szövege, vagy beépített. */
  introSource: OrderTextIntroSource
  /** Sorok beszállítói / saját cikkszám nélkül (a beszállító nehezebben azonosítja). */
  missingCodeCount: number
  text: string
  lineCount: number
  subject: string
  email: string | null
  phone: string | null
  preferred: OrderTextSupplier['preferred']
  links: { name: string; url: string }[]
}

function fmtQty(qty: number): string {
  return qty.toLocaleString('hu-HU', { maximumFractionDigits: 3 })
}

export function introToPlain(html: string | null | undefined): string {
  return (html ?? '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

type MergedLine = OrderTextLine & { parts: number[] }

/** Azonos cikkszám (vagy név) + egység több vevőnél → egy sor, összesített mennyiséggel. */
function mergeSameProduct(lines: OrderTextLine[]): MergedLine[] {
  const m = new Map<string, MergedLine>()
  for (const l of lines) {
    const key = `${(l.sku?.trim() || l.name.trim()).toLowerCase()}|${l.unitShortform.toLowerCase()}`
    const hit = m.get(key)
    if (hit) {
      hit.qty += l.qty
      hit.parts.push(l.qty)
      hit.supplierSku ||= l.supplierSku
      hit.shopUrl ||= l.shopUrl
    } else m.set(key, { ...l, parts: [l.qty] })
  }
  return [...m.values()]
}

/** Beszállítónként egy-egy másolható / e-mailezhető rendelési szöveg. */
export function buildOrderTextBlocks(
  lines: OrderTextLine[],
  companyName: string,
  suppliers: Map<string, OrderTextSupplier> = new Map(),
  date: Date = new Date(),
  companyIntro: string | null = null
): OrderTextBlock[] {
  const groups = new Map<string, { supplierId: string | null; rows: OrderTextLine[] }>()
  for (const l of lines) {
    const key = l.supplierName?.trim() || 'Beszállító nélkül'
    const g = groups.get(key) ?? { supplierId: l.supplierId ?? null, rows: [] }
    g.rows.push(l)
    groups.set(key, g)
  }
  const company = companyName.trim()
  const dateLabel = new Intl.DateTimeFormat('hu-HU', { dateStyle: 'short' }).format(date)

  return [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b, 'hu'))
    .map(([supplierName, g]) => {
      const meta = g.supplierId ? suppliers.get(g.supplierId) : undefined
      const rows = mergeSameProduct(g.rows)
      const body = rows
        .map((r, i) => {
          const code = (r.supplierSku || r.sku)?.trim()
          const sku = code ? ` – ${code}` : ''
          const split = r.parts.length > 1 ? ` (${r.parts.map(fmtQty).join(' + ')})` : ''
          return `${i + 1}. ${r.name}${sku} – ${fmtQty(r.qty)} ${r.unitShortform}${split}`
        })
        .join('\n')
      const supplierIntro = introToPlain(meta?.intro)
      const fallbackIntro = introToPlain(companyIntro)
      const introSource: OrderTextIntroSource = supplierIntro ? 'supplier' : fallbackIntro ? 'company' : 'default'
      const head =
        supplierIntro ||
        fallbackIntro ||
        `${supplierName === 'Beszállító nélkül' ? 'Kedves Partnerünk!' : `Kedves ${supplierName}!`}\n\nAz alábbiakat szeretném megrendelni:`
      const sign = company ? `\n\nKöszönöm,\n${company}` : '\n\nKöszönöm!'
      return {
        supplierId: g.supplierId,
        supplierName,
        introSource,
        missingCodeCount: rows.filter((r) => !(r.supplierSku || r.sku)?.trim()).length,
        lineCount: rows.length,
        text: `${head}\n\n${body}${sign}`,
        subject: `Megrendelés${company ? ` – ${company}` : ''} – ${dateLabel}`,
        email: meta?.email ?? null,
        phone: meta?.phone ?? null,
        preferred: meta?.preferred ?? null,
        links: rows.filter((r) => r.shopUrl).map((r) => ({ name: r.name, url: r.shopUrl! }))
      }
    })
}
