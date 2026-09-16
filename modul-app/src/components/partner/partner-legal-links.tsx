'use client'

import { useState } from 'react'
import { ChevronDown, Scale } from 'lucide-react'

import { getLegalUrls } from '@/lib/legal/urls'
import { cn } from '@/lib/utils'

type Props = {
  className?: string
  /**
   * `inline` — auth/regisztráció: ÁSZF · Adatkezelés · Impresszum
   * `sidebar` — összecsukható „Jogi” menüpont + second-level linkek
   */
  variant?: 'inline' | 'sidebar'
}

const LINKS = [
  { key: 'aszf' as const, label: 'ÁSZF' },
  { key: 'privacy' as const, label: 'Adatkezelés' },
  { key: 'impressum' as const, label: 'Impresszum' }
]

/** Partner shell — ugyanazok a jogi URL-ek, mint a staff app. */
export function PartnerLegalLinks({
  className,
  variant = 'inline'
}: Props) {
  const urls = getLegalUrls()
  const [open, setOpen] = useState(false)

  if (variant === 'sidebar') {
    return (
      <div className={cn('px-2', className)}>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex h-8 w-full items-center gap-2 rounded-md px-2 text-left text-ink-secondary transition-colors duration-fast hover:bg-stone-100 hover:text-ink"
          aria-expanded={open}
        >
          <Scale className="size-4 shrink-0 text-ink-muted" aria-hidden />
          <span className="min-w-0 flex-1 truncate text-[13px] font-medium">
            Jogi
          </span>
          <ChevronDown
            className={cn(
              'size-3.5 shrink-0 text-ink-muted transition-transform duration-fast',
              open && 'rotate-180'
            )}
            aria-hidden
          />
        </button>

        {open ? (
          <nav
            className="mt-0.5 flex flex-col gap-0.5"
            aria-label="Jogi dokumentumok"
          >
            {LINKS.map((item) => (
              <a
                key={item.key}
                href={urls[item.key]}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-md py-1 pl-8 pr-2 text-[12px] text-ink-muted no-underline transition-colors duration-fast hover:bg-stone-100 hover:text-ink"
              >
                {item.label}
              </a>
            ))}
          </nav>
        ) : null}
      </div>
    )
  }

  const linkClass = 'underline-offset-2 hover:text-ink hover:underline'

  return (
    <p className={cn('text-center text-hint text-ink-muted', className)}>
      {LINKS.map((item, i) => (
        <span key={item.key}>
          {i > 0 ? <span aria-hidden> · </span> : null}
          <a
            href={urls[item.key]}
            target="_blank"
            rel="noopener noreferrer"
            className={linkClass}
          >
            {item.label}
          </a>
        </span>
      ))}
    </p>
  )
}
