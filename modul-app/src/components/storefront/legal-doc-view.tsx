import { Info } from 'lucide-react'
import { Fragment, type ReactNode } from 'react'

import type { LegalDoc, LegalNode } from '@/lib/webshop/legal/types'

const LINK = /\[([^\]]+)\]\(([^)\s]+)\)/g

function safeHref(href: string): string | null {
  if (href.startsWith('/') || href.startsWith('#')) return href
  if (/^(https?:|mailto:|tel:)/i.test(href)) return href
  return null
}

function Inline({ text }: { text: string }) {
  const out: ReactNode[] = []
  let last = 0
  for (const m of text.matchAll(LINK)) {
    const at = m.index ?? 0
    if (at > last) out.push(text.slice(last, at))
    const href = safeHref(m[2])
    out.push(
      href ? (
        <a key={at} href={href} className="cursor-pointer text-ink underline underline-offset-2 hover:no-underline">
          {m[1]}
        </a>
      ) : (
        m[1]
      )
    )
    last = at + m[0].length
  }
  if (last < text.length) out.push(text.slice(last))
  return <>{out}</>
}

function Node({ node, form }: { node: LegalNode; form?: ReactNode }) {
  switch (node.t) {
    case 'p':
      return (
        <p>
          <Inline text={node.text} />
        </p>
      )
    case 'h3':
      return <h3 className="pt-2 text-[15px] font-semibold text-ink">{node.text}</h3>
    case 'note':
      return (
        <p className="flex gap-2 rounded-md border border-stone-200 bg-stone-50 px-3 py-2.5 text-ink">
          <Info className="mt-0.5 size-4 shrink-0 text-ink-muted" aria-hidden />
          <span>
            <Inline text={node.text} />
          </span>
        </p>
      )
    case 'ul':
    case 'ol': {
      const List = node.t === 'ul' ? 'ul' : 'ol'
      return (
        <List className={node.t === 'ul' ? 'list-disc space-y-1 pl-5' : 'list-decimal space-y-1 pl-5'}>
          {node.items.map((item, i) => (
            <li key={i}>
              <Inline text={item} />
            </li>
          ))}
        </List>
      )
    }
    case 'dl':
      return (
        <dl className="grid gap-x-4 gap-y-1 sm:grid-cols-[220px_1fr]">
          {node.rows.map(([k, v]) => (
            <Fragment key={k}>
              <dt className="text-ink-muted">{k}</dt>
              <dd className="text-ink">
                <Inline text={v} />
              </dd>
            </Fragment>
          ))}
        </dl>
      )
    case 'table':
      return (
        <div className="overflow-x-auto rounded-md border border-stone-200">
          <table className="w-full min-w-[560px] border-collapse text-left text-[14px]">
            <thead className="bg-stone-50 text-ink">
              <tr>
                {node.head.map((h) => (
                  <th key={h} scope="col" className="border-b border-stone-200 px-3 py-2 font-medium">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {node.rows.map((row, i) => (
                <tr key={i} className="border-b border-stone-100 last:border-0 align-top">
                  {row.map((cell, j) => (
                    <td key={j} className="px-3 py-2">
                      <Inline text={cell} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )
    case 'form':
      return <>{form ?? null}</>
  }
}

export function LegalDocView({
  doc,
  form,
  meta,
  archiveNotice
}: {
  doc: LegalDoc
  /** Az elállási oldal űrlapja (kliens komponens). */
  form?: ReactNode
  meta: ReactNode
  archiveNotice?: ReactNode
}) {
  return (
    <article className="mx-auto max-w-[820px] px-4 pb-16 pt-5 text-[15px] leading-relaxed text-ink-secondary lg:px-8 lg:pt-8">
      {archiveNotice}
      <h1 className="text-[22px] font-semibold tracking-[-0.01em] text-ink">{doc.title}</h1>
      {doc.summary.length > 0 ? (
        <dl className="mt-4 grid gap-2 sm:grid-cols-2">
          {doc.summary.map((s) => (
            <div key={s.label} className="rounded-md border border-stone-200 px-3 py-2">
              <dt className="text-[12px] text-ink-muted">{s.label}</dt>
              <dd className="text-[14px] font-medium text-ink">{s.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      <div className="mt-5 space-y-3">
        {doc.intro.map((t, i) => (
          <p key={i}>
            <Inline text={t} />
          </p>
        ))}
      </div>
      {doc.sections.length > 2 ? (
        <nav aria-label="Tartalom" className="mt-6 rounded-md border border-stone-200 px-4 py-3">
          <p className="text-[13px] font-medium text-ink">Tartalom</p>
          <ol className="mt-1.5 space-y-1 text-[14px]">
            {doc.sections.map((s) => (
              <li key={s.id}>
                <a href={`#${s.id}`} className="cursor-pointer hover:text-ink hover:underline">
                  {s.title}
                </a>
              </li>
            ))}
          </ol>
        </nav>
      ) : null}
      {doc.sections.map((s) => (
        <section key={s.id} id={s.id} aria-labelledby={`${s.id}-h`} className="mt-8 scroll-mt-20 space-y-3">
          <h2 id={`${s.id}-h`} className="text-[17px] font-semibold text-ink">
            {s.title}
          </h2>
          {s.nodes.map((n, i) => (
            <Node key={i} node={n} form={form} />
          ))}
        </section>
      ))}
      <footer className="mt-10 border-t border-stone-200 pt-4 text-[13px] text-ink-muted">{meta}</footer>
    </article>
  )
}
