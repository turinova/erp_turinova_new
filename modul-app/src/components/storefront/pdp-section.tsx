import { ChevronDown } from 'lucide-react'

import { cn } from '@/lib/utils'

/** Az egyetlen H2 méret a storefronton (szekció- és sín-címek). */
export const SECTION_TITLE = 'text-[17px] font-semibold tracking-tight text-ink'

/**
 * Egységes, függőlegesen összecsukható szekció. A tartalom zárva is a DOM-ban
 * marad (oldalon belüli keresés, SEO).
 */
export function PdpSection({
  id,
  title,
  count,
  aside,
  defaultOpen = false,
  children
}: {
  id?: string
  title: string
  count?: number
  aside?: React.ReactNode
  defaultOpen?: boolean
  children: React.ReactNode
}) {
  return (
    <details
      id={id}
      {...(defaultOpen ? { open: true } : {})}
      className="group scroll-mt-4 border-t border-stone-200 first:border-t-0"
    >
      <summary className="flex min-h-14 cursor-pointer list-none items-center gap-3 py-3 [&::-webkit-details-marker]:hidden">
        <h2 className="min-w-0 flex-1 text-[16px] font-semibold tracking-tight text-ink">
          {title}
          {count != null ? (
            <span className="font-normal tabular-nums text-ink-secondary"> ({count})</span>
          ) : null}
        </h2>
        {aside ? (
          <span className="shrink-0 text-[13px] text-ink-secondary">{aside}</span>
        ) : null}
        <ChevronDown
          className="size-5 shrink-0 text-ink-secondary transition-transform duration-200 group-open:rotate-180 motion-reduce:transition-none"
          aria-hidden
        />
      </summary>
      <div className="pb-5 text-[15px] leading-relaxed text-ink-secondary">{children}</div>
    </details>
  )
}

/** Blokkok közötti fő zóna-elválasztó (32px ritmus). */
export function ZoneDivider({ className }: { className?: string }) {
  return <hr className={cn('my-8 border-stone-200', className)} />
}
