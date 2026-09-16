import Link from 'next/link'
import Image from 'next/image'
import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

const LEGAL_NAV = [
  { href: '/impresszum', label: 'Impresszum' },
  { href: '/aszf', label: 'ÁSZF' },
  { href: '/adatkezelesi-tajekoztato', label: 'Adatkezelés' }
] as const

/** Minimal markdown → React (headings, lists, paragraphs, bare URLs). */
export function renderLegalMarkdown(md: string): ReactNode[] {
  const lines = md.replace(/\r\n/g, '\n').split('\n')
  const out: ReactNode[] = []
  let i = 0
  let key = 0

  const flushParagraph = (buf: string[]) => {
    const text = buf.join(' ').trim()
    if (!text) return
    out.push(
      <p key={key++} className="mt-3 text-[14px] leading-relaxed text-ink">
        {linkify(text)}
      </p>
    )
  }

  while (i < lines.length) {
    const line = lines[i] ?? ''
    const trimmed = line.trim()

    if (!trimmed) {
      i += 1
      continue
    }

    if (trimmed === '---') {
      out.push(
        <hr key={key++} className="my-8 border-border" />
      )
      i += 1
      continue
    }

    const heading = trimmed.match(/^(#{1,5})\s+(.*)$/)
    if (heading) {
      const level = heading[1].length
      const title = heading[2].trim()
      if (level <= 1) {
        out.push(
          <h1
            key={key++}
            className="mt-10 text-[22px] font-semibold tracking-tight text-ink first:mt-0"
          >
            {title}
          </h1>
        )
      } else if (level === 2) {
        out.push(
          <h2
            key={key++}
            className="mt-8 text-[17px] font-semibold tracking-tight text-ink"
          >
            {title}
          </h2>
        )
      } else {
        out.push(
          <h3
            key={key++}
            className="mt-6 text-[15px] font-semibold text-ink"
          >
            {title}
          </h3>
        )
      }
      i += 1
      continue
    }

    if (/^[-*]\s+/.test(trimmed)) {
      const items: string[] = []
      while (i < lines.length) {
        const li = (lines[i] ?? '').trim()
        if (!/^[-*]\s+/.test(li)) break
        items.push(li.replace(/^[-*]\s+/, ''))
        i += 1
      }
      out.push(
        <ul
          key={key++}
          className="mt-3 list-disc space-y-2 pl-5 text-[14px] leading-relaxed text-ink"
        >
          {items.map((item, idx) => (
            <li key={idx}>{linkify(item)}</li>
          ))}
        </ul>
      )
      continue
    }

    const buf: string[] = [trimmed]
    i += 1
    while (i < lines.length) {
      const next = (lines[i] ?? '').trim()
      if (!next || /^(#{1,5})\s+/.test(next) || /^[-*]\s+/.test(next) || next === '---')
        break
      buf.push(next)
      i += 1
    }
    flushParagraph(buf)
  }

  return out
}

function linkify(text: string): ReactNode {
  const parts: ReactNode[] = []
  const re = /(https?:\/\/[^\s)]+|www\.[^\s)]+)/gi
  let last = 0
  let m: RegExpExecArray | null
  let k = 0
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index))
    const raw = m[0]
    const href = raw.startsWith('http') ? raw : `https://${raw}`
    parts.push(
      <a
        key={k++}
        href={href}
        className="underline underline-offset-2 hover:text-ink"
        target="_blank"
        rel="noopener noreferrer"
      >
        {raw}
      </a>
    )
    last = m.index + raw.length
  }
  if (last < text.length) parts.push(text.slice(last))
  return parts.length === 1 ? parts[0] : parts
}

export function LegalShell({
  children,
  activeHref
}: {
  children: ReactNode
  activeHref: string
}) {
  return (
    <main className="min-h-dvh bg-app">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <Link
            href="/hamarosan"
            className="inline-flex no-underline transition-opacity hover:opacity-80"
          >
            <Image
              src="/images/optinova-logo.png"
              alt="Optinova"
              width={140}
              height={28}
              className="h-7 w-auto"
              priority
            />
          </Link>
          <p className="text-[12px] text-ink-muted">HÍRÖS-ABLAK Kft.</p>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
        <nav
          aria-label="Jogi dokumentumok"
          className="mb-8 flex flex-wrap gap-x-3 gap-y-2 text-[12px] text-ink-muted"
        >
          {LEGAL_NAV.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={cn(
                'underline-offset-2 hover:text-ink hover:underline',
                l.href === activeHref
                  ? 'font-medium text-ink underline'
                  : 'underline'
              )}
            >
              {l.label}
            </Link>
          ))}
        </nav>
        <article>{children}</article>
        <p className="mt-12 border-t border-border pt-6 text-[12px] text-ink-muted">
          Kapcsolat:{' '}
          <a
            href="mailto:info@turinova.hu"
            className="underline underline-offset-2 hover:text-ink"
          >
            info@turinova.hu
          </a>
          {' · '}
          +36 30 999 2800
          {' · '}
          6000 Kecskemét, Mindszenti krt. 10.
        </p>
      </div>
    </main>
  )
}
